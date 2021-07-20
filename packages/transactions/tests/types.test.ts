import {
  Address,
  LengthPrefixedString,
  AssetInfo,
  createLPString,
  createAddress,
  createLPList,
  serializeStacksMessage,
  deserializeLPList,
  addressToString,
  addressFromHashMode,
  createAssetInfo,
  LengthPrefixedList,
  addressFromPublicKeys,
} from '../src/types';

import { TransactionVersion, AddressHashMode, StacksMessageType } from '../src/constants';

import { serializeDeserialize } from './macros';
import { BufferReader } from '../src/bufferReader';
import { createStacksPublicKey } from '../src/keys';

test('Length prefixed strings serialization and deserialization', () => {
  const testString = 'test message string';
  const lpString = createLPString(testString);
  const deserialized = serializeDeserialize(
    lpString,
    StacksMessageType.LengthPrefixedString
  ) as LengthPrefixedString;
  expect(deserialized.content).toBe(testString);

  const longTestString = 'a'.repeat(129);
  expect(() => createLPString(longTestString)).toThrow('String length exceeds maximum bytes 128');
});

test('Length prefixed list serialization and deserialization', () => {
  const addressList = [
    createAddress('SP9YX31TK12T0EZKWP3GZXX8AM37JDQHAWM7VBTH'),
    createAddress('SP26KJ60PHEBVMJ7DD515T3VEMM4XWJG7GMWSDFC2'),
    createAddress('SP3ZZXBQXNA8296BV0D6W38FK3SK0XWM26EFT4M8C'),
    createAddress('SP3E6KW7QVBBGBZDSNWWPX9672Z4MZPRRM2X68KKM'),
    createAddress('SP15ZKFY43G0P3XBW95RHK82PYDT8B38QYFRY75EV'),
  ];

  const l = [];
  for (let index = 0; index < addressList.length; index++) {
    l.push(addressList[index]);
  }
  const lpList: LengthPrefixedList = createLPList(l);
  const serialized = serializeStacksMessage(lpList);

  const bufferReader = new BufferReader(serialized);
  const deserialized = deserializeLPList(bufferReader, StacksMessageType.Address);

  expect(deserialized.values.length).toBe(addressList.length);

  for (let index = 0; index < addressList.length; index++) {
    expect(deserialized.values[index].toString()).toBe(addressList[index].toString());
  }
});

test('C32 address hash mode - testnet P2PKH', () => {
  const address = addressToString(
    addressFromHashMode(
      AddressHashMode.SerializeP2PKH,
      TransactionVersion.Testnet,
      'c22d24fec5d06e539c551e732a5ba88997761ba0'
    )
  );
  const expected = 'ST312T97YRQ86WMWWAMF76AJVN24SEXGVM1Z5EH0F';
  expect(address).toBe(expected);
});

test('C32 address hash mode - mainnet P2PKH', () => {
  const address = addressToString(
    addressFromHashMode(
      AddressHashMode.SerializeP2PKH,
      TransactionVersion.Mainnet,
      'b976e9f5d6181e40bed7fa589142dfcf2fb28d8e'
    )
  );
  const expected = 'SP2WQDTFNTRC1WG5YTZX5H4A2VZ7JZCMDHV3PQATJ';
  expect(address).toBe(expected);
});

test('C32 address hash mode - mainnet P2SH', () => {
  const address = addressToString(
    addressFromHashMode(
      AddressHashMode.SerializeP2SH,
      TransactionVersion.Mainnet,
      '55011fc38a7e12f7d00496aef7a1c4b6dfeba81b'
    )
  );
  const expected = 'SM1AG27Y3H9Z15XYG0JBAXXX1RJVDZTX83FA1DDSJ';
  expect(address).toBe(expected);
});

test('C32 address hash mode - testnet P2SH', () => {
  const address = addressToString(
    addressFromHashMode(
      AddressHashMode.SerializeP2SH,
      TransactionVersion.Testnet,
      '55011fc38a7e12f7d00496aef7a1c4b6dfeba81b'
    )
  );
  const expected = 'SN1AG27Y3H9Z15XYG0JBAXXX1RJVDZTX83DE2F6ME';
  expect(address).toBe(expected);
});

test('C32 address hash mode - mainnet P2WSH', () => {
  const address = addressToString(
    addressFromHashMode(
      AddressHashMode.SerializeP2WSH,
      TransactionVersion.Mainnet,
      '55011fc38a7e12f7d00496aef7a1c4b6dfeba81b'
    )
  );
  const expected = 'SM1AG27Y3H9Z15XYG0JBAXXX1RJVDZTX83FA1DDSJ';
  expect(address).toBe(expected);
});

test('C32 address hash mode - testnet P2WSH', () => {
  const address = addressToString(
    addressFromHashMode(
      AddressHashMode.SerializeP2WSH,
      TransactionVersion.Testnet,
      '55011fc38a7e12f7d00496aef7a1c4b6dfeba81b'
    )
  );
  const expected = 'SN1AG27Y3H9Z15XYG0JBAXXX1RJVDZTX83DE2F6ME';
  expect(address).toBe(expected);
});


test('C32check addresses serialization and deserialization', () => {
  const c32AddressString = 'SP9YX31TK12T0EZKWP3GZXX8AM37JDQHAWM7VBTH';
  const addr = createAddress(c32AddressString);
  const deserialized = serializeDeserialize(addr, StacksMessageType.Address) as Address;
  expect(addressToString(deserialized)).toBe(c32AddressString);
});

test('Asset info serialization and deserialization', () => {
  const assetAddress = 'SP2ZP4GJDZJ1FDHTQ963F0292PE9J9752TZJ68F21';
  const assetContractName = 'contract_name';
  const assetName = 'asset_name';
  const info = createAssetInfo(assetAddress, assetContractName, assetName);
  const deserialized = serializeDeserialize(info, StacksMessageType.AssetInfo) as AssetInfo;
  expect(addressToString(deserialized.address)).toBe(assetAddress);
  expect(deserialized.contractName.content).toBe(assetContractName);
  expect(deserialized.assetName.content).toBe(assetName);
});


// address/mod.rs: test_public_keys_to_address_hash()
test('Public keys to address hash', () => {
  const fixtures = [
    {
      keys: [createStacksPublicKey('040fadbbcea0ff3b05f03195b41cd991d7a0af8bd38559943aec99cbdaf0b22cc806b9a4f07579934774cc0c155e781d45c989f94336765e88a66d91cfb9f060b0')],
      numRequired: 1,
      segwit: false,
      result: '395f3643cea07ec4eec73b4d9a973dcce56b9bf1',
    },
    {
      keys: [
        createStacksPublicKey('040fadbbcea0ff3b05f03195b41cd991d7a0af8bd38559943aec99cbdaf0b22cc806b9a4f07579934774cc0c155e781d45c989f94336765e88a66d91cfb9f060b0'),
        createStacksPublicKey('04c77f262dda02580d65c9069a8a34c56bd77325bba4110b693b90216f5a3edc0bebc8ce28d61aa86b414aa91ecb29823b11aeed06098fcd97fee4bc73d54b1e96')
      ],
      numRequired: 2,
      segwit: false,
      result: 'fd3a5e9f5ba311ce6122765f0af8da7488e25d3a',
    },
    {
      keys: [createStacksPublicKey('020fadbbcea0ff3b05f03195b41cd991d7a0af8bd38559943aec99cbdaf0b22cc8')],
      numRequired: 1,
      segwit: true,
      result: '0ac7ad046fe22c794dd923b3be14b2e668e50c42',
    },
    {
      keys: [createStacksPublicKey('020fadbbcea0ff3b05f03195b41cd991d7a0af8bd38559943aec99cbdaf0b22cc8'),
      createStacksPublicKey('02c77f262dda02580d65c9069a8a34c56bd77325bba4110b693b90216f5a3edc0b')],
      numRequired: 2,
      segwit: true,
      result: '3e02fa83ac2fae11fd6703b91e7c94ad393052e2',
     }
  ];

  for (const fixture of fixtures) {
    let hashMode;

    if (!fixture.segwit) {
      if (fixture.numRequired === 1) hashMode = AddressHashMode.SerializeP2PKH;
      else hashMode = AddressHashMode.SerializeP2SH;
    } else {
      if (fixture.numRequired === 1) hashMode = AddressHashMode.SerializeP2WPKH;
      else hashMode = AddressHashMode.SerializeP2WSH;
    }

    const address = addressFromPublicKeys(0, hashMode, fixture.numRequired, fixture.keys);
    expect(address.hash160).toBe(fixture.result);
  }
});
