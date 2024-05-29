import { Buffer } from '../utils/Buffer';

// Text Representation: "🌎 Hello World 🌎"
const text = {
  base64: '8J+MjiBIZWxsbyBXb3JsZCDwn4yO',
  buffer: Uint8Array.from([
    240, 159, 140, 142, 32, 72, 101, 108, 108, 111, 32, 87, 111, 114, 108, 100,
    32, 240, 159, 140, 142,
  ]),
  bytes: [
    240, 159, 140, 142, 32, 72, 101, 108, 108, 111, 32, 87, 111, 114, 108, 100,
    32, 240, 159, 140, 142,
  ],
};

/** Create a `Buffer` class instance pre-populated with data. */
function setup() {
  const buffer = new Buffer();
  buffer.setBuffer(text.buffer);
  return buffer;
}

describe('`Buffer` Class', () => {
  describe('Static Methods', () => {
    it('Buffer.base64ToBuffer()', () => {
      expect(Buffer.base64ToBuffer(text.base64)).toEqual(text.buffer);
    });

    it('Buffer.byteToBinary()', () => {
      expect(Buffer.byteToBinary(49)).toEqual('00110001');
    });

    it('Buffer.bytesToBase64()', () => {
      expect(Buffer.bytesToBase64(text.bytes)).toEqual(text.base64);
    });

    describe('Buffer.bytesToInt()', () => {
      it('Little Endian', () => {
        expect(Buffer.bytesToInt([208, 111, 152], 8, false)).toEqual(9990096);
      });

      it('Big Endian', () => {
        expect(Buffer.bytesToInt([208, 111, 152])).toEqual(13660056);
      });

      it('Synchsafe Integer [Big Endian]', () => {
        expect(Buffer.bytesToInt([208, 111, 152], 7)).toEqual(3422104);
      });
    });

    describe('Buffer.bytesToString()', () => {
      const bytesBE = [
        254, 255, 48, 83, 48, 147, 48, 107, 48, 97, 48, 111, 78, 22, 117, 76, 0,
        0,
      ];

      describe('UTF-16 w/ BOM', () => {
        it('Little Endian', () => {
          const bytes = [
            255, 254, 83, 48, 147, 48, 107, 48, 97, 48, 111, 48, 22, 78, 76,
            117, 0, 0,
          ];
          expect(Buffer.bytesToString(bytes, 1)).toEqual('こんにちは世界');
        });

        it('Big Endian', () => {
          expect(Buffer.bytesToString(bytesBE, 1)).toEqual('こんにちは世界');
        });
      });

      it('UTF-16BE w/o BOM', () => {
        const bytes = bytesBE.slice(2);
        expect(Buffer.bytesToString(bytes, 2)).toEqual('こんにちは世界');
      });

      it('UTF-8', () => {
        const bytes = [
          227, 129, 147, 227, 130, 147, 227, 129, 171, 227, 129, 161, 227, 129,
          175, 228, 184, 150, 231, 149, 140,
        ];
        expect(Buffer.bytesToString(bytes, 3)).toEqual('こんにちは世界');
      });

      it('ISO-8859-1', () => {
        const bytes = [50, 48, 50, 52, 0];
        expect(Buffer.bytesToString(bytes, 0)).toEqual('2024');
      });
    });

    it('Buffer.readBitsInByte()', () => {
      expect(Buffer.readBitsInByte(49, 2, 2)).toEqual(3);
    });
  });

  describe('Instance Properties', () => {
    it('Buffer.prototype.buffer', () => {
      const buffer = setup();
      expect(buffer.buffer).toEqual(text.buffer);
    });

    describe('Buffer.prototype.eof', () => {
      const buffer = setup();

      it('Returns `false` on initialization.', () => {
        expect(buffer.eof).toEqual(false);
      });

      it('Returns `true` after reaching/passing end of buffer.', () => {
        buffer.move(100);
        expect(buffer.eof).toEqual(true);
      });
    });

    it('Buffer.prototype.length', () => {
      const buffer = setup();
      expect(buffer.length).toEqual(21);
    });

    describe('Buffer.prototype.position', () => {
      const buffer = setup();

      it('Returns `0` on initialization.', () => {
        expect(buffer.position).toEqual(0);
      });

      it('Returns `current position + {distance moved}` after moving.', () => {
        buffer.move(10);
        expect(buffer.position).toEqual(10);
      });

      it('Returns `{buffer size}` after moving out of buffer range.', () => {
        buffer.move(100);
        expect(buffer.position).toEqual(21);
      });
    });
  });

  describe('Instance Methods', () => {
    it('Buffer.prototype.setBuffer()', () => {
      const buffer = setup();
      const newBuffer = Uint8Array.from([71, 111, 111]);
      buffer.setBuffer(newBuffer);
      expect(buffer.buffer).toEqual(newBuffer);
    });

    describe('Buffer.prototype.move()', () => {
      const buffer = setup();

      it('Returns `{distance moved}`.', () => {
        expect(buffer.move(1)).toEqual(1);
        expect(buffer.move(10)).toEqual(10);
      });

      it('Returns `{distance to eof from current position}` if moving out of buffer range.', () => {
        expect(buffer.move(100)).toEqual(10);
      });
    });

    describe('Buffer.prototype.readUInt8()', () => {
      const buffer = setup();

      it('Returns 1st byte.', () => {
        expect(buffer.readUInt8()).toEqual(240);
      });

      it('Returns 2nd byte.', () => {
        expect(buffer.readUInt8()).toEqual(159);
      });
    });

    describe('Buffer.prototype.readBytes()', () => {
      const buffer = setup();

      it('Returns array containing 1st byte.', () => {
        expect(buffer.readBytes(1)).toEqual([240]);
      });

      it('Returns array containing next 10 bytes.', () => {
        expect(buffer.readBytes(10)).toEqual([
          159, 140, 142, 32, 72, 101, 108, 108, 111, 32,
        ]);
      });

      it('Returns array of remaining bytes.', () => {
        expect(buffer.readBytes(100)).toEqual([
          87, 111, 114, 108, 100, 32, 240, 159, 140, 142,
        ]);
      });
    });
  });
});
