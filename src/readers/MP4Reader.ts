import type { MetadataKey } from '../MetadataExtractor.types';
import { Buffer } from '../utils/Buffer';
import { FileError } from '../utils/errors';
import { FileReader } from '../utils/FileReader';

/*
  Useful documentation:
    - https://developer.apple.com/documentation/quicktime-file-format
    - https://web.archive.org/web/20091024221536/http://geocities.com/xhelmboyx/quicktime/formats/mp4-layout.txt
    - https://exiftool.org/TagNames/QuickTime.html
*/

/** Array of User data atom names we'll support. */
const UserDataAtomNames = [
  ...['©alb', '©ART', '©nam', 'trkn', '©day', 'covr'],
] as const;

type FieldName = (typeof UserDataAtomNames)[number];

/** User data atom name Metadata Map */
const UDTAMetadataMap: Record<FieldName, MetadataKey> = {
  '©alb': 'album',
  '©ART': 'artist',
  '©nam': 'name',
  'trkn': 'track',
  '©day': 'year',
  'covr': 'artwork',
};

/** Names of containers we care about */
const ContainerAtoms = new Set(['udta', 'meta', 'ilst']);

/** Reads m4a/mp4 metadata, which is used to provide metadata for `AAC`. */
export class MP4Reader extends FileReader {
  majorBrand = '';
  minorVersion = 0;

  /** Get mp4 metadata. */
  async getMetadata() {
    await this.initialize();

    // Process the file.
    while (!this.finished) await this.processAtom();

    // Return the results.
    return {
      format: `${this.majorBrand} (${this.minorVersion})`,
      metadata: this.formatMetadata(),
    };
  }

  /**
   * Initialize buffer through `FileReader`.
   *
   * Throws an error if we don't encounter an `ftype` atom/box.
   *
   * https://developer.apple.com/documentation/quicktime-file-format/file_type_compatibility_atom
   */
  async initialize() {
    await this.initDataFrom({ size: 16 });
    // First 8 bytes is the header.
    const atomSize = Buffer.bytesToInt(this.read(4)); // Size of header w/ content.
    const atomType = Buffer.bytesToString(this.read(4));

    if (atomType !== 'ftyp')
      throw new FileError('Does not follow proper mp4 format.');

    // Read content of `ftyp` box for file type.
    this.majorBrand = Buffer.bytesToString(this.read(4));
    this.minorVersion = Buffer.bytesToInt(this.read(4));

    // Skip "Compatible Brands" section.
    const remainingAtomSize = atomSize - 16;
    await this.initDataFrom({
      size: remainingAtomSize,
      offset: this.filePosition,
    });
    this.skip(remainingAtomSize);
    // FileReader.skip() will prematurely set `this.finished = true`.
    this.finished = false;
  }

  /**
   * mp4 metadata is stored inside of "Atoms" made up of:
   *  - A (8 or 16)-byte header.
   *  - Data whose size is specified by its header.
   *
   * https://developer.apple.com/documentation/quicktime-file-format/atoms
   */
  async processAtom() {
    // Handle the atom header.
    const { isLast, type, length } = await this.processAtomHeader();

    // Exit early if `isLast` is true.
    if (isLast) {
      this.finished = true;
      return;
    }

    // Handle the atom data.
    await this.initDataFrom({ size: length, offset: this.filePosition });
    // Metadata is generally stored in the movie atom.
    if (type === 'moov') {
      this.processAtomContainer();
    } else {
      this.skip(length);
    }

    // We need to make sure `this.finished` is `false` when reading this
    // file as we don't know the amount of space Atoms take up cumulatively
    // in the file unlike with ID3.
    if (type === 'moov' || this.shouldFinishEarly()) this.finished = true;
    else this.finished = false;
  }

  /**
   * An Atom Header is made up of atleast 8 bytes specifying:
   *  - [1 Byte] Size (includes header)
   *  - [1 Byte] Type
   *  - [Optional 2 Byte] Extended Size
   */
  async processAtomHeader() {
    await this.initDataFrom({ size: 8, offset: this.filePosition });
    let atomSize = Buffer.bytesToInt(this.read(4)); // Size of header w/ content.
    const atomType = Buffer.bytesToString(this.read(4));

    let remainingAtomSize = atomSize - 8;

    if (atomSize === 1) {
      // We have an "Extended Size" field.
      await this.initDataFrom({ size: 8, offset: this.filePosition });
      atomSize = Buffer.bytesToInt(this.read(8));
      remainingAtomSize = atomSize - 16;
    }

    return {
      isLast: atomSize === 0,
      type: atomType,
      length: remainingAtomSize,
    };
  }

  /** Search for metadata inside of the `udta` atoms inside an atom container. */
  processAtomContainer() {
    while (true) {
      const { isLast, type, length } = this.processAtomContainerHeader();

      // Break out of loop early if we've got all the metadata we needed.
      if (isLast || this.shouldFinishEarly()) break;

      if (ContainerAtoms.has(type)) {
        // We want to ignore the next 4 bytes as it contains version info.
        if (type === 'meta') this.skip(4);
        this.processAtomContainer();
      } else if (UserDataAtomNames.includes(type as FieldName)) {
        // We have an APPLE annotation atom which is located in the
        // `moov.udta.meta.ilst` atom.
        this.processItemDataAtom(type as FieldName, length);
      } else {
        this.skip(length);
      }
    }
  }

  /** Basically `processAtomHeader`, except all the data is in the buffer. */
  processAtomContainerHeader() {
    let atomSize = Buffer.bytesToInt(this.read(4)); // Size of header w/ content.
    const atomType = Buffer.bytesToString(this.read(4));

    let remainingAtomSize = atomSize - 8;

    if (atomSize === 1) {
      // We have an "Extended Size" field.
      atomSize = Buffer.bytesToInt(this.read(8));
      remainingAtomSize = atomSize - 16;
    }

    return {
      isLast: atomSize === 0,
      type: atomType,
      length: remainingAtomSize,
    };
  }

  /**
   * Process an APPLE item data atom containing the metadata we're
   * interested in.
   *
   * Find `ilst` section at the very end in:
   * https://web.archive.org/web/20091024221536/http://geocities.com/xhelmboyx/quicktime/formats/mp4-layout.txt
   */
  processItemDataAtom(type: FieldName, size: number) {
    this.skip(4); // Size of item data atom w/ annotation atom header.
    this.skip(4); // The string `data`.
    this.skip(1); // Version number which should be `0`.
    const flag = Buffer.bytesToInt(this.read(3));
    this.skip(4); // Reserved as 32-bit value set to `0`.
    let remainingSize = size - 16;

    if (type === 'trkn') {
      this.tags.track = `${Buffer.bytesToInt(this.read(remainingSize))}`;
    } else if (type === 'covr') {
      const mimeType = `image/${flag === 14 ? 'png' : 'jpeg'}`;
      this.tags.artwork = `data:${mimeType};base64,${Buffer.bytesToBase64(this.read(remainingSize))}`;
    } else {
      // Strings should be UTF-8.
      this.tags[UDTAMetadataMap[type]] = Buffer.bytesToString(
        this.read(remainingSize),
        3
      );
    }
  }
}
