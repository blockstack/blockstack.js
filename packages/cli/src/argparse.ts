import Ajv from 'ajv';
import * as process from 'process';
import * as path from 'path';
import * as os from 'os';

import * as fs from 'fs';

export const NAME_PATTERN = '^([0-9a-z_.+-]{3,37})$';

export const NAMESPACE_PATTERN = '^([0-9a-z_-]{1,19})$';

export const ADDRESS_CHARS = '[123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz]{1,35}';

export const C32_ADDRESS_CHARS = '[0123456789ABCDEFGHJKMNPQRSTVWXYZ]+';

export const ADDRESS_PATTERN = `^(${ADDRESS_CHARS})$`;

export const ID_ADDRESS_PATTERN = `^ID-${ADDRESS_CHARS}$`;

export const STACKS_ADDRESS_PATTERN = `^(${C32_ADDRESS_CHARS})$`;

// hex private key
export const PRIVATE_KEY_PATTERN = '^([0-9a-f]{64,66})$';

// hex private key, no compression
export const PRIVATE_KEY_UNCOMPRESSED_PATTERN = '^([0-9a-f]{64})$';

// nosign:addr
export const PRIVATE_KEY_NOSIGN_PATTERN = `^nosign:${ADDRESS_CHARS}$`;

// m,pk1,pk2,...,pkn
export const PRIVATE_KEY_MULTISIG_PATTERN = '^([0-9]+),([0-9a-f]{64,66},)*([0-9a-f]{64,66})$';

// segwit:p2sh:m,pk1,pk2,...,pkn
export const PRIVATE_KEY_SEGWIT_P2SH_PATTERN =
  '^segwit:p2sh:([0-9]+),([0-9a-f]{64,66},)*([0-9a-f]{64,66})$';

// any private key pattern we support
export const PRIVATE_KEY_PATTERN_ANY = `${PRIVATE_KEY_PATTERN}|${PRIVATE_KEY_MULTISIG_PATTERN}|${PRIVATE_KEY_SEGWIT_P2SH_PATTERN}|${PRIVATE_KEY_NOSIGN_PATTERN}`;

export const PUBLIC_KEY_PATTERN = '^([0-9a-f]{66,130})$';

export const INT_PATTERN = '^-?[0-9]+$';

export const ZONEFILE_HASH_PATTERN = '^([0-9a-f]{40})$';

export const URL_PATTERN = '^http[s]?://.+$';

export const SUBDOMAIN_PATTERN = '^([0-9a-z_+-]{1,37}).([0-9a-z_.+-]{3,37})$';

export const TXID_PATTERN = '^([0-9a-f]{64})$';

export const BOOLEAN_PATTERN = '^(0|1|true|false)$';

export interface CLI_LOG_CONFIG_TYPE {
  level: string;
  handleExceptions: boolean;
  timestamp: boolean;
  stringify: boolean;
  colorize: boolean;
  json: boolean;
}

export interface CLI_CONFIG_TYPE {
  blockstackAPIUrl: string;
  blockstackNodeUrl: string;
  broadcastServiceUrl: string;
  utxoServiceUrl: string;
  logConfig: CLI_LOG_CONFIG_TYPE;
  bitcoindUsername?: string;
  bitcoindPassword?: string;
}

const LOG_CONFIG_DEFAULTS: CLI_LOG_CONFIG_TYPE = {
  level: 'info',
  handleExceptions: true,
  timestamp: true,
  stringify: true,
  colorize: true,
  json: true,
};

const CONFIG_DEFAULTS: CLI_CONFIG_TYPE = {
  blockstackAPIUrl: 'http://stacks-node-api.stacks.co',
  blockstackNodeUrl: 'http://stacks-node-api.stacks.co',
  broadcastServiceUrl: 'http://stacks-node-api.stacks.co/v2/transactions',
  utxoServiceUrl: 'https://blockchain.info',
  logConfig: LOG_CONFIG_DEFAULTS,
};

const CONFIG_REGTEST_DEFAULTS: CLI_CONFIG_TYPE = {
  blockstackAPIUrl: 'http://localhost:16268',
  blockstackNodeUrl: 'http://localhost:16264',
  broadcastServiceUrl: 'http://localhost:16269',
  utxoServiceUrl: 'http://localhost:18332',
  logConfig: LOG_CONFIG_DEFAULTS,
  bitcoindPassword: 'blockstacksystem',
  bitcoindUsername: 'blockstack',
};

const CONFIG_LOCALNET_DEFAULTS = {
  blockstackAPIUrl: `http://localhost:20443`,
  blockstackNodeUrl: `http://localhost:20443`,
  broadcastServiceUrl: `http://localhost:20443/v2/transactions`,
  utxoServiceUrl: `http://localhost:18332`,
  logConfig: Object.assign({}, LOG_CONFIG_DEFAULTS, { level: 'debug' }),
};

const PUBLIC_TESTNET_HOST = 'testnet-master.blockstack.org';

const CONFIG_TESTNET_DEFAULTS = {
  blockstackAPIUrl: `http://${PUBLIC_TESTNET_HOST}:20443`,
  blockstackNodeUrl: `http://${PUBLIC_TESTNET_HOST}:20443`,
  broadcastServiceUrl: `http://${PUBLIC_TESTNET_HOST}:20443/v2/transactions`,
  utxoServiceUrl: `http://${PUBLIC_TESTNET_HOST}:18332`,
  logConfig: Object.assign({}, LOG_CONFIG_DEFAULTS, { level: 'debug' }),
};

export const DEFAULT_CONFIG_PATH = '~/.blockstack-cli.conf';
export const DEFAULT_CONFIG_REGTEST_PATH = path.join(os.homedir(), '.blockstack-cli-regtest.conf');
export const DEFAULT_CONFIG_TESTNET_PATH = path.join(os.homedir(), '.blockstack-cli-testnet.conf');

export const DEFAULT_MAX_ID_SEARCH_INDEX = 256;

interface CLI_PROP_ITEM {
  name: string;
  type: 'string';
  realtype: string;
  pattern?: string;
}

interface CLI_PROP {
  [index: string]: {
    type: 'array';
    items: CLI_PROP_ITEM[];
    minItems: number;
    maxItems: number;
    help: string;
    group: string;
  };
}

// CLI usage
export const CLI_ARGS = {
  type: 'object',
  properties: {
    announce: {
      type: 'array',
      items: [
        {
          name: 'message_hash',
          type: 'string',
          realtype: 'zonefile_hash',
          pattern: ZONEFILE_HASH_PATTERN,
        },
        {
          name: 'owner_key',
          type: 'string',
          realtype: 'private_key',
          pattern: `${PRIVATE_KEY_PATTERN_ANY}`,
        },
      ],
      minItems: 2,
      maxItems: 2,
      help:
        'Broadcast a message on the blockchain for subscribers to read.  ' +
        'The `MESSAGE_HASH` argument must be the hash of a previously-announced zone file.  ' +
        'The `OWNER_KEY` used to sign the transaction must correspond to the Blockstack ID ' +
        'to which other users have already subscribed.  `OWNER_KEY` can be a single private key ' +
        'or a serialized multisig private key bundle.\n' +
        '\n' +
        'If this command succeeds, it will print a transaction ID.  The rest of the Blockstack peer ' +
        'network will process it once the transaction reaches 7 confirmations.\n' +
        '\n' +
        'Examples:\n' +
        '\n' +
        '    $ # Tip: You can obtain the owner key with the get_owner_keys command\n' +
        '    $ export OWNER_KEY="136ff26efa5db6f06b28f9c8c7a0216a1a52598045162abfe435d13036154a1b01"\n' +
        '    $ stx announce 737c631c7c5d911c6617993c21fba731363f1cfe "$OWNER_KEY"\n' +
        '    d51749aeec2803e91a2f8bdec8d3e413491fd816b4962372b214ab74acb0bba8\n' +
        '\n' +
        '    $ export OWNER_KEY="2,136ff26efa5db6f06b28f9c8c7a0216a1a52598045162abfe435d13036154a1b01,1885cba486a42960499d1f137ef3a475725ceb11f45d74631f9928280196f67401,2418981c7f3a91d4467a65a518e14fafa30e07e6879c11fab7106ea72b49a7cb01"\n' +
        '    $ stx announce 737c631c7c5d911c6617993c21fba731363f1cfe "$OWNER_KEY"\n' +
        '    8136a1114098893b28a693e8d84451abf99ee37ef8766f4bc59808eed76968c9\n' +
        '\n',
      group: 'Peer Services',
    },
    authenticator: {
      type: 'array',
      items: [
        {
          name: 'app_gaia_hub',
          type: 'string',
          realtype: 'url',
          pattern: URL_PATTERN,
        },
        {
          name: 'backup_phrase',
          type: 'string',
          realtype: '12_words_or_ciphertext',
          pattern: '.+',
        },
        {
          name: 'profile_gaia_hub',
          type: 'string',
          realtype: 'url',
          pattern: URL_PATTERN,
        },
        {
          name: 'port',
          type: 'string',
          realtype: 'portnum',
          pattern: '^[0-9]+',
        },
      ],
      minItems: 2,
      maxItems: 4,
      help:
        'Run an authentication endpoint for the set of names owned ' +
        'by the given backup phrase.  Send applications the given Gaia hub URL on sign-in, ' +
        'so the application will use it to read/write user data.\n' +
        '\n' +
        'You can supply your encrypted backup phrase instead of the raw backup phrase.  If so, ' +
        'then you will be prompted for your password before any authentication takes place.\n' +
        '\n' +
        'Example:\n' +
        '\n' +
        '    $ export BACKUP_PHRASE="oak indicate inside poet please share dinner monitor glow hire source perfect"\n' +
        '    $ export APP_GAIA_HUB="https://1.2.3.4"\n' +
        '    $ export PROFILE_GAIA_HUB="https://hub.blockstack.org"\n' +
        '    $ stx authenticator "$APP_GAIA_HUB" "$BACKUP_PHRASE" "$PROFILE_GAIA_HUB" 8888\n' +
        '    Press Ctrl+C to exit\n' +
        '    Authentication server started on 8888\n',
      group: 'Authentication',
    },
    balance: {
      type: 'array',
      items: [
        {
          name: 'address',
          type: 'string',
          realtype: 'address',
          pattern: `${ADDRESS_PATTERN}|${STACKS_ADDRESS_PATTERN}`,
        },
      ],
      minItems: 1,
      maxItems: 1,
      help:
        'Query the balance of an account.  Returns the balances of each kind of token ' +
        'that the account owns.  The balances will be in the *smallest possible units* of the ' +
        'token (i.e. satoshis for BTC, microStacks for Stacks, etc.).\n' +
        '\n' +
        'Example:\n' +
        '\n' +
        '    $ stx balance 16pm276FpJYpm7Dv3GEaRqTVvGPTdceoY4\n' +
        '    {\n' +
        '      "BTC": "123456"\n' +
        '      "STACKS": "123456"\n' +
        '    }\n' +
        '    $ stx balance SPZY1V53Z4TVRHHW9Z7SFG8CZNRAG7BD8WJ6SXD0\n' +
        '    {\n' +
        '      "BTC": "123456"\n' +
        '      "STACKS": "123456"\n' +
        '    }\n',
      group: 'Account Management',
    },
    can_stack: {
      type: 'array',
      items: [
        {
          name: 'amount',
          type: 'string',
          realtype: 'integer',
          pattern: '^[0-9]+$',
        },
        {
          name: 'cycles',
          type: 'string',
          realtype: 'integer',
          pattern: '^[0-9]+$',
        },
        {
          name: 'pox_address',
          type: 'string',
          realtype: 'address',
          pattern: `${ADDRESS_PATTERN}`,
        },
        {
          name: 'stx_address',
          type: 'string',
          realtype: 'address',
          pattern: `${STACKS_ADDRESS_PATTERN}`,
        },
      ],
      minItems: 4,
      maxItems: 4,
      help:
        'Check if specified account can stack a number of Stacks tokens for given number of cycles.\n' +
        '\n' +
        'Example:\n' +
        '\n' +
        '    $ stx can_stack 10000000 20 16pm276FpJYpm7Dv3GEaRqTVvGPTdceoY4 SPZY1V53Z4TVRHHW9Z7SFG8CZNRAG7BD8WJ6SXD0\n' +
        '    {\n' +
        '      "eligible": true\n' +
        '    }\n',
      group: 'Account Management',
    },
    call_contract_func: {
      type: 'array',
      items: [
        {
          name: 'contract_address',
          type: 'string',
          realtype: 'address',
          pattern: `${STACKS_ADDRESS_PATTERN}`,
        },
        {
          name: 'contract_name',
          type: 'string',
          realtype: 'string',
          pattern: '^[a-zA-Z]([a-zA-Z0-9]|[-_])*$',
        },
        {
          name: 'function_name',
          type: 'string',
          realtype: 'string',
          pattern: '^[a-zA-Z]([a-zA-Z0-9]|[-_!?])*$',
        },
        {
          name: 'fee',
          type: 'string',
          realtype: 'integer',
          pattern: '^[0-9]+$',
        },
        {
          name: 'nonce',
          type: 'string',
          realtype: 'integer',
          pattern: '^[0-9]+$',
        },
        {
          name: 'payment_key',
          type: 'string',
          realtype: 'private_key',
          pattern: `${PRIVATE_KEY_PATTERN_ANY}`,
        },
      ],
      minItems: 6,
      maxItems: 6,
      help:
        'Call a function in a deployed Clarity smart contract.\n' +
        '\n' +
        'If the command succeeds, it prints out a transaction ID.' +
        '\n' +
        'Example:\n' +
        '    $ export PAYMENT="bfeffdf57f29b0cc1fab9ea197bb1413da2561fe4b83e962c7f02fbbe2b1cd5401"\n' +
        '    $ stx call_contract_func SPBMRFRPPGCDE3F384WCJPK8PQJGZ8K9QKK7F59X contract_name' +
        '      contract_function 1 0 "$PAYMENT"\n' +
        '     {\n' +
        "       txid: '0x2e33ad647a9cedacb718ce247967dc705bc0c878db899fdba5eae2437c6fa1e1'," +
        "       transaction: 'https://explorer.stacks.co/txid/0x2e33ad647a9cedacb718ce247967dc705bc0c878db899fdba5eae2437c6fa1e1'" +
        '     }\n' +
        '\n',
      group: 'Account Management',
    },
    call_read_only_contract_func: {
      type: 'array',
      items: [
        {
          name: 'contract_address',
          type: 'string',
          realtype: 'address',
          pattern: `${STACKS_ADDRESS_PATTERN}`,
        },
        {
          name: 'contract_name',
          type: 'string',
          realtype: 'string',
          pattern: '^[a-zA-Z]([a-zA-Z0-9]|[-_])*$',
        },
        {
          name: 'function_name',
          type: 'string',
          realtype: 'string',
          pattern: '^[a-zA-Z]([a-zA-Z0-9]|[-_!?])*$',
        },
        {
          name: 'sender_address',
          type: 'string',
          realtype: 'address',
          pattern: `${STACKS_ADDRESS_PATTERN}`,
        },
      ],
      minItems: 4,
      maxItems: 4,
      help:
        'Call a read-only function in a deployed Clarity smart contract.\n' +
        '\n' +
        'If the command succeeds, it prints out a Clarity value.' +
        '\n' +
        'Example:\n' +
        '    $ stx call_read_only_contract_func SPBMRFRPPGCDE3F384WCJPK8PQJGZ8K9QKK7F59X contract_name' +
        '     contract_function SPBMRFRPPGCDE3F384WCJPK8PQJGZ8K9QKK7F59X\n' +
        '     {\n' +
        "       txid: '0x2e33ad647a9cedacb718ce247967dc705bc0c878db899fdba5eae2437c6fa1e1'," +
        "       transaction: 'https://explorer.stacks.co/txid/0x2e33ad647a9cedacb718ce247967dc705bc0c878db899fdba5eae2437c6fa1e1'" +
        '     }\n' +
        '\n',
      group: 'Account Management',
    },
    convert_address: {
      type: 'array',
      items: [
        {
          name: 'address',
          type: 'string',
          realtype: 'address',
          pattern: `${ADDRESS_PATTERN}|${STACKS_ADDRESS_PATTERN}`,
        },
      ],
      minItems: 1,
      maxItems: 1,
      help:
        'Convert a Bitcoin address to a Stacks address and vice versa.\n' +
        '\n' +
        'Example:\n' +
        '\n' +
        '    $ stx convert_address 12qdRgXxgNBNPnDeEChy3fYTbSHQ8nfZfD\n' +
        '    {\n' +
        '      "mainnet": {\n' +
        '        "STACKS": "SPA2MZWV9N67TBYVWTE0PSSKMJ2F6YXW7CBE6YPW",\n' +
        '        "BTC": "12qdRgXxgNBNPnDeEChy3fYTbSHQ8nfZfD"\n' +
        '      }\n' +
        '    }\n' +
        '    $ stx convert_address SPA2MZWV9N67TBYVWTE0PSSKMJ2F6YXW7CBE6YPW\n' +
        '    {\n' +
        '      "mainnet": {\n' +
        '        "STACKS": "SPA2MZWV9N67TBYVWTE0PSSKMJ2F6YXW7CBE6YPW",\n' +
        '        "BTC": "12qdRgXxgNBNPnDeEChy3fYTbSHQ8nfZfD"\n' +
        '      }\n' +
        '    }\n' +
        '    $ stx convert_address SPA2MZWV9N67TBYVWTE0PSSKMJ2F6YXW7CBE6YPW -t\n' +
        '    {\n' +
        '      "mainnet": {\n' +
        '        "STACKS": "SPA2MZWV9N67TBYVWTE0PSSKMJ2F6YXW7CBE6YPW",\n' +
        '        "BTC": "12qdRgXxgNBNPnDeEChy3fYTbSHQ8nfZfD"\n' +
        '      },\n' +
        '      "testnet": {\n' +
        '        "STACKS": "STA2MZWV9N67TBYVWTE0PSSKMJ2F6YXW7DX96QAM",\n' +
        '        "BTC": "mhMaijcwVPcdAthFwmgLsaknTRt72GqQYo"\n' +
        '      }\n' +
        '    }\n' +
        '    $ stx convert_address STA2MZWV9N67TBYVWTE0PSSKMJ2F6YXW7DX96QAM\n' +
        '    {\n' +
        '      "mainnet": {\n' +
        '        "STACKS": "SPA2MZWV9N67TBYVWTE0PSSKMJ2F6YXW7CBE6YPW",\n' +
        '        "BTC": "12qdRgXxgNBNPnDeEChy3fYTbSHQ8nfZfD"\n' +
        '      },\n' +
        '      "testnet": {\n' +
        '        "STACKS": "STA2MZWV9N67TBYVWTE0PSSKMJ2F6YXW7DX96QAM",\n' +
        '        "BTC": "mhMaijcwVPcdAthFwmgLsaknTRt72GqQYo"\n' +
        '      }\n' +
        '    }\n',
      group: 'Account Management',
    },
    decrypt_keychain: {
      type: 'array',
      items: [
        {
          name: 'encrypted_backup_phrase',
          type: 'string',
          realtype: 'encrypted_backup_phrase',
          pattern: '^[^ ]+$',
        },
        {
          name: 'password',
          type: 'string',
          realtype: 'password',
          pattern: '.+',
        },
      ],
      minItems: 1,
      maxItems: 2,
      help:
        'Decrypt an encrypted backup phrase with a password.  Decrypts to a 12-word ' +
        'backup phrase if done correctly.  The password will be prompted if not given.\n' +
        '\n' +
        'Example:\n' +
        '\n' +
        '    $ # password is "asdf"\n' +
        '    $ stx decrypt_keychain "bfMDtOucUGcJXjZo6vkrZWgEzue9fzPsZ7A6Pl4LQuxLI1xsVF0VPgBkMsnSLCmYS5YHh7R3mNtMmX45Bq9sNGPfPsseQMR0fD9XaHi+tBg=\n' +
        '    Enter password:\n' +
        '    section amount spend resemble spray verify night immune tattoo best emotion parrot',
      group: 'Key Management',
    },
    deploy_contract: {
      type: 'array',
      items: [
        {
          name: 'source_file',
          type: 'string',
          realtype: 'path',
          pattern: '.+',
        },
        {
          name: 'contract_name',
          type: 'string',
          realtype: 'string',
          pattern: '^[a-zA-Z]([a-zA-Z0-9]|[-_])*$',
        },
        {
          name: 'fee',
          type: 'string',
          realtype: 'integer',
          pattern: '^[0-9]+$',
        },
        {
          name: 'nonce',
          type: 'string',
          realtype: 'integer',
          pattern: '^[0-9]+$',
        },
        {
          name: 'payment_key',
          type: 'string',
          realtype: 'private_key',
          pattern: `${PRIVATE_KEY_PATTERN_ANY}`,
        },
      ],
      minItems: 5,
      maxItems: 5,
      help:
        'Deploys a Clarity smart contract on the network.\n' +
        '\n' +
        'If the command succeeds, it prints out a transaction ID.' +
        '\n' +
        'Example:\n' +
        '    $ export PAYMENT="bfeffdf57f29b0cc1fab9ea197bb1413da2561fe4b83e962c7f02fbbe2b1cd5401"\n' +
        '    $ stx deploy_contract ./my_contract.clar my_contract 1 0 "$PAYMENT"\n' +
        '     {\n' +
        "       txid: '0x2e33ad647a9cedacb718ce247967dc705bc0c878db899fdba5eae2437c6fa1e1'," +
        "       transaction: 'https://explorer.stacks.co/txid/0x2e33ad647a9cedacb718ce247967dc705bc0c878db899fdba5eae2437c6fa1e1'" +
        '     }\n' +
        '\n',
      group: 'Account Management',
    },
    docs: {
      type: 'array',
      items: [
        {
          name: 'format',
          type: 'string',
          realtype: 'output_format',
          pattern: '^json$',
        },
      ],
      minItems: 0,
      maxItems: 1,
      help: 'Dump the documentation for all commands as JSON to standard out.',
      group: 'CLI',
    },
    encrypt_keychain: {
      type: 'array',
      items: [
        {
          name: 'backup_phrase',
          type: 'string',
          realtype: 'backup_phrase',
          pattern: '.+',
        },
        {
          name: 'password',
          type: 'string',
          realtype: 'password',
          pattern: '.+',
        },
      ],
      minItems: 1,
      maxItems: 2,
      help:
        'Encrypt a 12-word backup phrase, which can be decrypted later with the ' +
        '`decrypt_backup_phrase` command.  The password will be prompted if not given.\n' +
        '\n' +
        'Example:\n' +
        '\n' +
        '     $ # password is "asdf"\n' +
        '     $ stx encrypt_keychain "section amount spend resemble spray verify night immune tattoo best emotion parrot"\n' +
        '     Enter password:\n' +
        '     Enter password again:\n' +
        '     M+DnBHYb1fgw4N3oZ+5uTEAua5bAWkgTW/SjmmBhGGbJtjOtqVV+RrLJEJOgT35hBon4WKdGWye2vTdgqDo7+HIobwJwkQtN2YF9g3zPsKk=',
      group: 'Key Management',
    },
    faucet: {
      type: 'array',
      items: [
        {
          name: 'address',
          type: 'string',
          realtype: 'address',
          pattern: `${ADDRESS_PATTERN}|${STACKS_ADDRESS_PATTERN}`,
        },
      ],
      minItems: 1,
      maxItems: 1,
      help:
        'Encrypt a 12-word backup phrase, which can be decrypted later with the ' +
        '`decrypt_backup_phrase` command.  The password will be prompted if not given.\n' +
        '\n' +
        'Example:\n' +
        '\n' +
        '     $ # password is "asdf"\n' +
        '     $ blockstack-cli encrypt_keychain "section amount spend resemble spray verify night immune tattoo best emotion parrot"\n' +
        '     Enter password:\n' +
        '     Enter password again:\n' +
        '     M+DnBHYb1fgw4N3oZ+5uTEAua5bAWkgTW/SjmmBhGGbJtjOtqVV+RrLJEJOgT35hBon4WKdGWye2vTdgqDo7+HIobwJwkQtN2YF9g3zPsKk=',
      group: 'Key Management',
    },
    gaia_dump_bucket: {
      type: 'array',
      items: [
        {
          name: 'name_or_id_address',
          type: 'string',
          realtype: 'name_or_id_address',
          pattern: `${ID_ADDRESS_PATTERN}|${NAME_PATTERN}|${SUBDOMAIN_PATTERN}`,
        },
        {
          name: 'app_origin',
          type: 'string',
          realtype: 'url',
          pattern: URL_PATTERN,
        },
        {
          name: 'gaia_hub',
          type: 'string',
          realtype: 'url',
          pattern: URL_PATTERN,
        },
        {
          name: 'backup_phrase',
          type: 'string',
          realtype: '12_words_or_ciphertext',
        },
        {
          name: 'dump_dir',
          type: 'string',
          realtype: 'path',
          pattern: '.+',
        },
      ],
      minItems: 5,
      maxItems: 5,
      help:
        'Download the contents of a Gaia hub bucket to a given directory.  The `GAIA_HUB` argument ' +
        'must correspond to the *write* endpoint of the Gaia hub -- that is, you should be able to fetch ' +
        '`$GAIA_HUB/hub_info`.  If `DUMP_DIR` does not exist, it will be created.\n' +
        '\n' +
        'Example:\n' +
        '\n' +
        '    $ export BACKUP_PHRASE="section amount spend resemble spray verify night immune tattoo best emotion parrot\n' +
        '    $ stx gaia_dump_bucket hello.id.blockstack https://sample.app https://hub.blockstack.org "$BACKUP_PHRASE" ./backups\n' +
        '    Download 3 files...\n' +
        '    Download hello_world to ./backups/hello_world\n' +
        '    Download dir/format to ./backups/dir\\x2fformat\n' +
        '    Download /.dotfile to ./backups/\\x2f.dotfile\n' +
        '    3\n',
      group: 'Gaia',
    },
    gaia_getfile: {
      type: 'array',
      items: [
        {
          name: 'blockstack_id',
          type: 'string',
          realtype: 'blockstack_id',
          pattern: `${NAME_PATTERN}|${SUBDOMAIN_PATTERN}$`,
        },
        {
          name: 'app_origin',
          type: 'string',
          realtype: 'url',
          pattern: URL_PATTERN,
        },
        {
          name: 'filename',
          type: 'string',
          realtype: 'filename',
          pattern: '.+',
        },
        {
          name: 'app_private_key',
          type: 'string',
          realtype: 'private_key',
          pattern: PRIVATE_KEY_UNCOMPRESSED_PATTERN,
        },
        {
          name: 'decrypt',
          type: 'string',
          realtype: 'boolean',
          pattern: BOOLEAN_PATTERN,
        },
        {
          name: 'verify',
          type: 'string',
          realtype: 'boolean',
          pattern: BOOLEAN_PATTERN,
        },
      ],
      minItems: 3,
      maxItems: 6,
      help:
        "Get a file from another user's Gaia hub.  Prints the file data to stdout.  If you " +
        'want to read an encrypted file, and/or verify a signed file, then you must pass an app ' +
        'private key, and pass 1 for `DECRYPT` and/or `VERIFY`.  If the file is encrypted, and you do not ' +
        'pass an app private key, then this command downloads the ciphertext.  If the file is signed, ' +
        'and you want to download its data and its signature, then you must run this command twice -- ' +
        'once to get the file contents at `FILENAME`, and once to get the signature (whose name will be `FILENAME`.sig).\n' +
        '\n' +
        'Gaia is a key-value store, so it does not have any built-in notion of directories.  However, ' +
        'most underlying storage systems do -- directory separators in the name of a file in ' +
        "Gaia may be internally treated as first-class directories (it depends on the Gaia hub's driver)." +
        'As such, repeated directory separators will be treated as a single directory separator by this command.  ' +
        'For example, the file name `a/b.txt`, `/a/b.txt`, and `///a////b.txt` will be treated as identical.\n' +
        '\n' +
        'Example without encryption:\n' +
        '\n' +
        '    $ # Get an unencrypted, unsigned file\n' +
        '    $ stx gaia_getfile ryan.id http://public.ykliao.com statuses.json\n' +
        '    [{"id":0,"text":"Hello, Blockstack!","created_at":1515786983492}]\n' +
        '\n' +
        'Example with encryption:\n' +
        '\n' +
        '    $ # Get an encrypted file without decrypting\n' +
        '    $ stx gaia_getfile ryan.id https://app.graphitedocs.com documentscollection.json\n' +
        '    ' +
        '    $ # Get an encrypted file, and decrypt it\n' +
        '    $ # Tip: You can obtain the app key with the get_app_keys command\n' +
        '    $ export APP_KEY="3ac770e8c3d88b1003bf4a0a148ceb920a6172bdade8e0325a1ed1480ab4fb19"\n' +
        '    $ stx gaia_getfile ryan.id https://app.graphitedocs.com documentscollection.json "$APP_KEY" 1 0\n',
      group: 'Gaia',
    },
    gaia_putfile: {
      type: 'array',
      items: [
        {
          name: 'gaia_hub',
          type: 'string',
          realtype: 'url',
          pattern: URL_PATTERN,
        },
        {
          name: 'app_private_key',
          type: 'string',
          realtype: 'private_key',
          pattern: PRIVATE_KEY_UNCOMPRESSED_PATTERN,
        },
        {
          name: 'data_path',
          type: 'string',
          realtype: 'path',
          pattern: '.+',
        },
        {
          name: 'gaia_filename',
          type: 'string',
          realtype: 'filename',
          pattern: '.+',
        },
        {
          name: 'encrypt',
          type: 'string',
          realtype: 'boolean',
          pattern: BOOLEAN_PATTERN,
        },
        {
          name: 'sign',
          type: 'string',
          realtype: 'boolean',
          pattern: BOOLEAN_PATTERN,
        },
      ],
      minItems: 4,
      maxItems: 6,
      help:
        'Put a file into a given Gaia hub, authenticating with the given app private key.  ' +
        'Optionally encrypt and/or sign the data with the given app private key.  If the file is ' +
        'successfully stored, this command prints out the URLs at which it can be fetched.\n' +
        '\n' +
        'Gaia is a key-value store, so it does not have any built-in notion of directories.  However, ' +
        'most underlying storage systems do -- directory separators in the name of a file in ' +
        "Gaia may be internally treated as first-class directories (it depends on the Gaia hub's driver)." +
        'As such, repeated directory separators will be treated as a single directory separator by this command.  ' +
        'For example, the file name `a/b.txt`, `/a/b.txt`, and `///a////b.txt` will be treated as identical.\n' +
        '\n' +
        'Example:\n' +
        '\n' +
        '    $ # Store 4 versions of a file: plaintext, encrypted, signed, and encrypted+signed\n' +
        '    $ # Tip: You can obtain the app key with the get_app_keys command.\n' +
        '    $ export APP_KEY="3ac770e8c3d88b1003bf4a0a148ceb920a6172bdade8e0325a1ed1480ab4fb19"\n' +
        '    $ stx gaia_putfile https://hub.blockstack.org "$APP_KEY" /path/to/file.txt file.txt\n' +
        '    {\n' +
        '       "urls": "https://gaia.blockstack.org/hub/19KAzYp4kSKozeAGMUsnuqkEGdgQQLEvwo/file.txt"\n' +
        '    }\n' +
        '    $ stx gaia_putfile https://hub.blockstack.org "$APP_KEY" /path/to/file.txt file-encrypted.txt 1\n' +
        '    {\n' +
        '       "urls": "https://gaia.blockstack.org/hub/19KAzYp4kSKozeAGMUsnuqkEGdgQQLEvwo/file-encrypted.txt"\n' +
        '    }\n' +
        '    $ stx gaia_putfile https://hub.blockstack.org "$APP_KEY" /path/to/file.txt file-signed.txt 0 1\n' +
        '    {\n' +
        '       "urls": "https://gaia.blockstack.org/hub/19KAzYp4kSKozeAGMUsnuqkEGdgQQLEvwo/file-signed.txt"\n' +
        '    }\n' +
        '    $ stx gaia_putfile https://hub.blockstack.org "$APP_KEY" /path/to/file.txt file-encrypted-signed.txt 1 1\n' +
        '    {\n' +
        '       "urls": "https://gaia.blockstack.org/hub/19KAzYp4kSKozeAGMUsnuqkEGdgQQLEvwo/file-encrypted-signed.txt"\n' +
        '    }\n',
      group: 'Gaia',
    },
    gaia_deletefile: {
      type: 'array',
      items: [
        {
          name: 'gaia_hub',
          type: 'string',
          realtype: 'url',
          pattern: URL_PATTERN,
        },
        {
          name: 'app_private_key',
          type: 'string',
          realtype: 'private_key',
          pattern: PRIVATE_KEY_UNCOMPRESSED_PATTERN,
        },
        {
          name: 'gaia_filename',
          type: 'string',
          realtype: 'filename',
          pattern: '.+',
        },
        {
          name: 'was_signed',
          type: 'string',
          realtype: 'boolean',
          pattern: BOOLEAN_PATTERN,
        },
      ],
      minItems: 3,
      maxItems: 4,
      help:
        'Delete a file in a Gaia hub, as well as its signature metadata (which is stored in a separate file).' +
        '\n' +
        'Example:\n' +
        '\n' +
        '    $ # Tip: You can obtain the app key with the get_app_keys command.\n' +
        '    $ export APP_KEY="3ac770e8c3d88b1003bf4a0a148ceb920a6172bdade8e0325a1ed1480ab4fb19"\n' +
        '    $ stx gaia_deletefile https://hub.blockstack.org "$APP_KEY" file.txt false\n' +
        '    ok',
      group: 'Gaia',
    },
    gaia_listfiles: {
      type: 'array',
      items: [
        {
          name: 'gaia_hub',
          type: 'string',
          realtype: 'url',
          pattern: URL_PATTERN,
        },
        {
          name: 'app_private_key',
          type: 'string',
          realtype: 'private_key',
          pattern: PRIVATE_KEY_UNCOMPRESSED_PATTERN,
        },
      ],
      minItems: 2,
      maxItems: 3,
      help:
        'List all the files in a Gaia hub bucket.  You must have the private key for the bucket ' +
        'in order to list its contents.  The command prints each file name on its own line, and when ' +
        'finished, it prints the number of files listed.\n' +
        '\n' +
        'Example:\n' +
        '\n' +
        '    $ # Tip: You can obtain the app key with the get_app_keys command.\n' +
        '    $ export APP_KEY="3ac770e8c3d88b1003bf4a0a148ceb920a6172bdade8e0325a1ed1480ab4fb19"\n' +
        '    $ stx gaia_listfiles "https://hub.blockstack.org" "$APP_KEY"\n' +
        '    hello_world\n' +
        '    dir/format\n' +
        '    /.dotfile\n' +
        '    3\n',
      group: 'Gaia',
    },
    gaia_restore_bucket: {
      type: 'array',
      items: [
        {
          name: 'name_or_id_address',
          type: 'string',
          realtype: 'name_or_id_address',
          pattern: `${ID_ADDRESS_PATTERN}|${NAME_PATTERN}|${SUBDOMAIN_PATTERN}`,
        },
        {
          name: 'app_origin',
          type: 'string',
          realtype: 'url',
          pattern: URL_PATTERN,
        },
        {
          name: 'gaia_hub',
          type: 'string',
          realtype: 'url',
          pattern: URL_PATTERN,
        },
        {
          name: 'backup_phrase',
          type: 'string',
          realtype: '12_words_or_ciphertext',
        },
        {
          name: 'dump_dir',
          type: 'string',
          realtype: 'path',
          pattern: '.+',
        },
      ],
      minItems: 5,
      maxItems: 5,
      help:
        'Upload the contents of a previously-dumped Gaia bucket to a new Gaia hub.  The `GAIA_HUB` argument ' +
        'must correspond to the *write* endpoint of the Gaia hub -- that is, you should be able to fetch ' +
        '`$GAIA_HUB/hub_info`.  `DUMP_DIR` must contain the file contents created by a previous successful run of the gaia_dump_bucket command, ' +
        'and both `NAME_OR_ID_ADDRESS` and `APP_ORIGIN` must be the same as they were when it was run.\n' +
        '\n' +
        'Example:\n' +
        '\n' +
        '    $ export BACKUP_PHRASE="section amount spend resemble spray verify night immune tattoo best emotion parrot"\n' +
        '    $ stx gaia_restore_bucket hello.id.blockstack https://sample.app https://new.gaia.hub "$BACKUP_PHRASE" ./backups\n' +
        '    Uploaded ./backups/hello_world to https://new.gaia.hub/hub/1Lr8ggSgdmfcb4764woYutUfFqQMjEoKHc/hello_world\n' +
        '    Uploaded ./backups/dir\\x2fformat to https://new.gaia.hub/hub/1Lr8ggSgdmfcb4764woYutUfFqQMjEoKHc/dir/format\n' +
        '    Uploaded ./backups/\\x2f.dotfile to https://new.gaia.hub/hub/1Lr8ggSgdmfcb4764woYutUfFqQMjEoKHc//.dotfile\n' +
        '    3\n',
      group: 'Gaia',
    },
    gaia_sethub: {
      type: 'array',
      items: [
        {
          name: 'blockstack_id',
          type: 'string',
          realtype: 'blockstack_id',
          pattern: `^${NAME_PATTERN}|${SUBDOMAIN_PATTERN}$`,
        },
        {
          name: 'owner_gaia_hub',
          type: 'string',
          realtype: 'url',
          pattern: URL_PATTERN,
        },
        {
          name: 'app_origin',
          type: 'string',
          realtype: 'url',
          pattern: URL_PATTERN,
        },
        {
          name: 'app_gaia_hub',
          type: 'string',
          realtype: 'url',
          pattern: URL_PATTERN,
        },
        {
          name: 'backup_phrase',
          type: 'string',
          realtype: '12_words_or_ciphertext',
        },
      ],
      minItems: 5,
      maxItems: 5,
      help:
        'Set the Gaia hub for a particular application for a Blockstack ID.  If the command succeeds, ' +
        'the URLs to your updated profile will be printed and your profile will contain an entry in its "apps" ' +
        'key that links the given `APP_ORIGIN` to the given `APP_GAIA_HUB`.\n' +
        '\n' +
        'NOTE: Both `OWNER_GAIA_HUB` and `APP_GAIA_HUB` must be the *write* endpoints of their respective Gaia hubs.\n' +
        '\n' +
        'Your 12-word phrase (in either raw or encrypted form) is required to re-sign and store your ' +
        'profile and to generate an app-specific key and Gaia bucket.  If you give the encrypted backup phrase, you will be prompted for a password.\n' +
        '\n' +
        'Example:\n' +
        '\n' +
        '    $ export BACKUP_PHRASE="soap fog wealth upon actual blossom neither timber phone exile monkey vocal"\n' +
        '    $ stx gaia_sethub hello_world.id https://hub.blockstack.org https://my.cool.app https://my.app.gaia.hub "$BACKUP_PHRASE"\n' +
        '    {\n' +
        '      "profileUrls": {\n' +
        '        "error": null,\n' +
        '        "dataUrls": [\n' +
        '          "https://gaia.blockstack.org/hub/1ArdkA2oLaKnbNbLccBaFhEV4pYju8hJ82/profile.json"\n' +
        '        ]\n' +
        '      }\n' +
        '    }\n' +
        '    \n' +
        '    $ # You can check the new apps entry with curl and jq as follows:\n' +
        '    $ curl -sL https://gaia.blockstack.org/hub/1ArdkA2oLaKnbNbLccBaFhEV4pYju8hJ82/profile.json | jq ".[0].decodedToken.payload.claim.apps"\n' +
        '    {\n' +
        '      "https://my.cool.app": "https://my.app.gaia.hub/hub/1EqzyQLJ15KG1WQmi5cf1HtmSeqS1Wb8tY/"\n' +
        '    }\n' +
        '\n',
      group: 'Gaia',
    },
    get_account_history: {
      type: 'array',
      items: [
        {
          name: 'address',
          type: 'string',
          realtype: 'address',
          pattern: STACKS_ADDRESS_PATTERN,
        },
        {
          name: 'page',
          type: 'string',
          realtype: 'integer',
          pattern: '^[0-9]+$',
        },
      ],
      minItems: 2,
      maxItems: 2,
      help:
        'Query the history of account debits and credits over a given block range.  ' +
        'Returns the history one page at a time.  An empty result indicates that the page ' +
        'number has exceeded the number of historic operations in the given block range.\n' +
        '\n' +
        'Example:\n' +
        '\n' +
        '    $ stx get_account_history SP2H7VMY13ESQDAD5808QEY1EMGESMHZWBJRTN2YA 0\n' +
        '    [\n' +
        '      {\n' +
        '        "address": "SP2H7VMY13ESQDAD5808QEY1EMGESMHZWBJRTN2YA",\n' +
        '        "block_id": 56789\n' +
        '        "credit_value": "100000000000",\n' +
        '        "debit_value": "0",\n' +
        '        "lock_transfer_block_id": 0,\n' +
        '        "txid": "0e5db84d94adff5b771262b9df015164703b39bb4a70bf499a1602b858a0a5a1",\n' +
        '        "type": "STACKS",\n' +
        '        "vtxindex": 0\n' +
        '      },\n' +
        '      {\n' +
        '        "address": "SP2H7VMY13ESQDAD5808QEY1EMGESMHZWBJRTN2YA",\n' +
        '        "block_id": 56790,\n' +
        '        "credit_value": "100000000000",\n' +
        '        "debit_value": "64000000000",\n' +
        '        "lock_transfer_block_id": 0,\n' +
        '        "txid": "5a0c67144626f7bd4514e4de3f3bbf251383ca13887444f326bac4bc8b8060ee",\n' +
        '        "type": "STACKS",\n' +
        '        "vtxindex": 1\n' +
        '      },\n' +
        '      {\n' +
        '        "address": "SP2H7VMY13ESQDAD5808QEY1EMGESMHZWBJRTN2YA",\n' +
        '        "block_id": 56791,\n' +
        '        "credit_value": "100000000000",\n' +
        '        "debit_value": "70400000000",\n' +
        '        "lock_transfer_block_id": 0,\n' +
        '        "txid": "e54c271d6a9feb4d1859d32bc99ffd713493282adef5b4fbf50bca9e33fc0ecc",\n' +
        '        "type": "STACKS",\n' +
        '        "vtxindex": 2\n' +
        '      },\n' +
        '      {\n' +
        '        "address": "SP2H7VMY13ESQDAD5808QEY1EMGESMHZWBJRTN2YA",\n' +
        '        "block_id": 56792,\n' +
        '        "credit_value": "100000000000",\n' +
        '        "debit_value": "76800000000",\n' +
        '        "lock_transfer_block_id": 0,\n' +
        '        "txid": "06e0d313261baefec1e59783e256ab487e17e0e776e2fdab0920cc624537e3c8",\n' +
        '        "type": "STACKS",\n' +
        '        "vtxindex": 3\n' +
        '      }\n' +
        '    ]\n' +
        '\n',
      group: 'Account Management',
    },
    get_account_at: {
      type: 'array',
      items: [
        {
          name: 'address',
          type: 'string',
          realtype: 'address',
          pattern: STACKS_ADDRESS_PATTERN,
        },
        {
          name: 'blocknumber',
          type: 'string',
          realtype: 'integer',
          pattern: '^[0-9]+$',
        },
      ],
      minItems: 2,
      maxItems: 2,
      help:
        'Query the list of token debits and credits on a given address that occurred ' +
        'at a particular block height.  Does not include BTC debits and credits; only Stacks.\n' +
        '\n' +
        'Example\n' +
        '\n' +
        '    $ stx -t get_account_at SP2NTAQFECYGSTE1W47P71FG21H8F00KZZWFGEVKQ 56789\n' +
        '    [\n' +
        '      {\n' +
        '        "debit_value": "0",\n' +
        '        "block_id": 56789\n' +
        '        "lock_transfer_block_id": 0,\n' +
        '        "txid": "291817c78a865c1f72938695218a48174265b2358e89b9448edc89ceefd66aa0",\n' +
        '        "address": "SP2NTAQFECYGSTE1W47P71FG21H8F00KZZWFGEVKQ",\n' +
        '        "credit_value": "1000000000000000000",\n' +
        '        "type": "STACKS",\n' +
        '        "vtxindex": 0\n' +
        '      }\n' +
        '    ]\n' +
        '\n',
      group: 'Account Management',
    },
    get_address: {
      type: 'array',
      items: [
        {
          name: 'private_key',
          type: 'string',
          realtype: 'private_key',
          pattern: `${PRIVATE_KEY_PATTERN_ANY}`,
        },
      ],
      minItems: 1,
      maxItems: 1,
      help:
        'Get the address of a private key or multisig private key bundle.  Gives the BTC and STACKS addresses\n' +
        '\n' +
        'Example:\n' +
        '\n' +
        '    $ stx get_address f5185b9ca93bdcb5753fded3b097dab8547a8b47d2be578412d0687a9a0184cb01\n' +
        '    {\n' +
        '      "BTC": "1JFhWyVPpZQjbPcXFtpGtTmU22u4fhBVmq",\n' +
        '      "STACKS": "SP2YM3J4KQK09V670TD6ZZ1XYNYCNGCWCVVKSDFWQ"\n' +
        '    }\n' +
        '    $ stx get_address 1,f5185b9ca93bdcb5753fded3b097dab8547a8b47d2be578412d0687a9a0184cb01,ff2ff4f4e7f8a1979ffad4fc869def1657fd5d48fc9cf40c1924725ead60942c01\n' +
        '    {\n' +
        '      "BTC": "363pKBhc5ipDws1k5181KFf6RSxhBZ7e3p",\n' +
        '      "STACKS": "SMQWZ30EXVG6XEC1K4QTDP16C1CAWSK1JSWMS0QN"\n' +
        '    }',
      group: 'Key Management',
    },
    get_blockchain_record: {
      type: 'array',
      items: [
        {
          name: 'blockstack_id',
          type: 'string',
          realtype: 'blockstack_id',
          pattern: `^${NAME_PATTERN}|${SUBDOMAIN_PATTERN}$`,
        },
      ],
      minItems: 1,
      maxItems: 1,
      help:
        'Get the low-level blockchain-hosted state for a Blockstack ID.  This command ' +
        'is used mainly for debugging and diagnostics.  You should not rely on it to be stable.',
      group: 'Querying Blockstack IDs',
    },
    get_blockchain_history: {
      type: 'array',
      items: [
        {
          name: 'blockstack_id',
          type: 'string',
          realtype: 'blockstack_id',
          pattern: `${NAME_PATTERN}|${SUBDOMAIN_PATTERN}$`,
        },
        {
          name: 'page',
          type: 'string',
          realtype: 'page_number',
          pattern: '^[0-9]+$',
        },
      ],
      minItems: 1,
      maxItems: 2,
      help:
        'Get the low-level blockchain-hosted history of operations on a Blockstack ID.  ' +
        'This command is used mainly for debugging and diagnostics, and is not guaranteed to ' +
        'be stable across releases.',
      group: 'Querying Blockstack IDs',
    },
    get_confirmations: {
      type: 'array',
      items: [
        {
          name: 'txid',
          type: 'string',
          realtype: 'transaction_id',
          pattern: TXID_PATTERN,
        },
      ],
      minItems: 1,
      maxItems: 1,
      help:
        'Get the block height and number of confirmations for a transaction.\n' +
        '\n' +
        'Example:\n' +
        '\n' +
        '    $ stx get_confirmations e41ce043ab64fd5a5fd382fba21acba8c1f46cbb1d7c08771ada858ce7d29eea\n' +
        '    {\n' +
        '      "blockHeight": 567890,\n' +
        '      "confirmations": 7,\n' +
        '    }\n' +
        '\n',
      group: 'Peer Services',
    },
    get_namespace_blockchain_record: {
      type: 'array',
      items: [
        {
          name: 'namespace_id',
          type: 'string',
          realtype: 'namespace_id',
          pattern: NAMESPACE_PATTERN,
        },
      ],
      minItems: 1,
      maxItems: 1,
      help:
        'Get the low-level blockchain-hosted state for a Blockstack namespace.  This command ' +
        'is used mainly for debugging and diagnostics, and is not guaranteed to be stable across ' +
        'releases.',
      group: 'Namespace Operations',
    },
    get_app_keys: {
      type: 'array',
      items: [
        {
          name: 'backup_phrase',
          type: 'string',
          realtype: '12_words_or_ciphertext',
        },
        {
          name: 'index',
          type: 'string',
          realtype: 'integer',
          pattern: '^[0-9]+$',
        },
        {
          name: 'app_origin',
          type: 'string',
          realtype: 'url',
          pattern: URL_PATTERN,
        },
      ],
      minItems: 3,
      maxItems: 3,
      help:
        'Get the application private key from a 12- or 24-word Secret Key and an index of the enumerated associated accounts.  ' +
        'This is the private key used to sign data in Gaia, and its address is the Gaia bucket ' +
        'address.  If you provide your encrypted backup phrase, you will be asked to decrypt it.  ' +
        '\n' +
        'Example:\n' +
        '\n' +
        '    $ export BACKUP_PHRASE="one race buffalo dynamic icon drip width lake extra forest fee kit"\n' +
        '    $ stx get_app_keys "$BACKUP_PHRASE" 1 https://my.cool.dapp\n' +
        '    {\n' +
        '      "keyInfo": {\n' +
        '        "privateKey": "TODO",\n' +
        '        "address": "TODO"\n' +
        '      },\n' +
        '    }',
      group: 'Key Management',
    },
    get_owner_keys: {
      type: 'array',
      items: [
        {
          name: 'backup_phrase',
          type: 'string',
          realtype: '12_words_or_ciphertext',
        },
        {
          name: 'index',
          type: 'string',
          realtype: 'integer',
          pattern: '^[0-9]+$',
        },
      ],
      minItems: 1,
      maxItems: 2,
      help:
        'Get the list of owner private keys and ID-addresses from a 12-word backup phrase.  ' +
        'Pass non-zero values for INDEX to generate the sequence of ID-addresses that can be used ' +
        'to own Blockstack IDs.  If you provide an encrypted 12-word backup phrase, you will be ' +
        'asked for your password to decrypt it.\n' +
        '\n' +
        'Example:\n' +
        '\n' +
        '    $ # get the first 3 owner keys and addresses for a backup phrase\n' +
        '    $ export BACKUP_PHRASE="soap fog wealth upon actual blossom neither timber phone exile monkey vocal"\n' +
        '    $ stx get_owner_keys "$BACKUP_PHRASE" 3\n' +
        '    [\n' +
        '      {\n' +
        '        "privateKey": "14b0811d5cd3486d47279d8f3a97008647c64586b121e99862c18863e2a4183501",\n' +
        '        "version": "v0.10-current",\n' +
        '        "index": 0,\n' +
        '        "idAddress": "ID-1ArdkA2oLaKnbNbLccBaFhEV4pYju8hJ82"\n' +
        '      },\n' +
        '      {\n' +
        '        "privateKey": "1b3572d8dd6866828281ac6cf135f04153210c1f9b123743eccb795fd3095e4901",\n' +
        '        "version": "v0.10-current",\n' +
        '        "index": 1,\n' +
        '        "idAddress": "ID-18pR3UpD1KFrnk88a3MGZmG2dLuZmbJZ25"\n' +
        '      },\n' +
        '      {\n' +
        '        "privateKey": "b19b6d62356db96d570fb5f08b78f0aa7f384525ba3bdcb96fbde29b8e11710d01",\n' +
        '        "version": "v0.10-current",\n' +
        '        "index": 2,\n' +
        '        "idAddress": "ID-1Gx4s7ggkjENw3wSY6bNd1CwoQKk857AqN"\n' +
        '      }\n' +
        '    ]\n' +
        '\n',
      group: 'Key Management',
    },
    get_payment_key: {
      type: 'array',
      items: [
        {
          name: 'backup_phrase',
          type: 'string',
          realtype: '12_words_or_ciphertext',
        },
      ],
      minItems: 1,
      maxItems: 1,
      help:
        'Get the payment private key from a 12-word backup phrase.  If you provide an ' +
        'encrypted backup phrase, you will be asked for your password to decrypt it.  This command ' +
        'will tell you your Bitcoin and Stacks token addresses as well.\n' +
        '\n' +
        'Example\n' +
        '\n' +
        '    $ stx get_payment_key "soap fog wealth upon actual blossom neither timber phone exile monkey vocal"\n' +
        '    [\n' +
        '      {\n' +
        '        "privateKey": "4023435e33da4aff0775f33e7b258f257fb20ecff039c919b5782313ab73afb401",\n' +
        '        "address": {\n' +
        '          "BTC": "1ybaP1gaRwRSWRE4f8JXo2W8fiTZmA4rV",\n' +
        '          "STACKS": "SP5B89ZJAQHBRXVYP15YB5PAY5E24FEW9K4Q63PE"\n' +
        '        },\n' +
        '        "index": 0\n' +
        '      }\n' +
        '    ]\n' +
        '\n',
      group: 'Key Management',
    },
    get_stacks_wallet_key: {
      type: 'array',
      items: [
        {
          name: 'backup_phrase',
          type: 'string',
          realtype: '24_words_or_ciphertext',
        },
      ],
      minItems: 1,
      maxItems: 1,
      help:
        'Get the payment private key from a 24-word backup phrase used by the Stacks wallet.  If you provide an ' +
        'encrypted backup phrase, you will be asked for your password to decrypt it.  This command ' +
        'will tell you your Bitcoin and Stacks token addresses as well.\n' +
        '\n' +
        'Example\n' +
        '\n' +
        '    $ stx get_stacks_payment_key "toast canal educate tissue express melody produce later gospel victory meadow outdoor hollow catch liberty annual gasp hat hello april equip thank neck cruise"\n' +
        '    [\n' +
        '      {\n' +
        '        "privateKey": "a25cea8d310ce656c6d427068c77bad58327334f73e39c296508b06589bc4fa201",\n' +
        '        "address": {\n' +
        '          "BTC": "1ATAW6TAbTCKgU3xPgAcWQwjW9Q26Eambx",\n' +
        '          "STACKS": "SP1KTQR7CTQNA20SV2VNTF9YABMR6RJERSES3KC6Z"\n' +
        '        },\n' +
        '        "index": 0\n' +
        '      }\n' +
        '    ]\n' +
        '\n',
      group: 'Key Management',
    },
    get_zonefile: {
      type: 'array',
      items: [
        {
          name: 'zonefile_hash',
          type: 'string',
          realtype: 'zonefile_hash',
          pattern: ZONEFILE_HASH_PATTERN,
        },
      ],
      minItems: 1,
      maxItems: 1,
      help:
        'Get a zone file by hash.\n' +
        '\n' +
        'Example:\n' +
        '\n' +
        '    $ stx get_zonefile ee77ad484b7b229f09461e4c2b6d3bd3e152ba95\n' +
        '    $ORIGIN ryanshea.id\n' +
        '    $TTL 3600\n' +
        '    _http._tcp URI 10 1 "https://gaia.blockstack.org/hub/15BcxePn59Y6mYD2fRLCLCaaHScefqW2No/1/profile.json"\n' +
        '\n',
      group: 'Peer Services',
    },
    help: {
      type: 'array',
      items: [
        {
          name: 'command',
          type: 'string',
          realtype: 'command',
        },
      ],
      minItems: 0,
      maxItems: 1,
      help: 'Get the usage string for a CLI command',
      group: 'CLI',
    },
    lookup: {
      type: 'array',
      items: [
        {
          name: 'blockstack_id',
          type: 'string',
          realtype: 'blockstack_id',
          pattern: `${NAME_PATTERN}|${SUBDOMAIN_PATTERN}$`,
        },
      ],
      minItems: 1,
      maxItems: 1,
      help:
        'Get and authenticate the profile and zone file for a Blockstack ID.\n' +
        '\n' +
        'Example:\n' +
        '\n' +
        '    $ stx lookup example.id\n' +
        '\n',
      group: 'Querying Blockstack IDs',
    },
    names: {
      type: 'array',
      items: [
        {
          name: 'id_address',
          type: 'string',
          realtype: 'id-address',
          pattern: ID_ADDRESS_PATTERN,
        },
      ],
      minItems: 1,
      maxItems: 1,
      help:
        'Get the list of Blockstack IDs owned by an ID-address.\n' +
        '\n' +
        'Example:\n' +
        '\n' +
        '    $ stx names ID-1FpBChfzHG3TdQQRKWAipbLragCUArueG9\n' +
        '\n',
      group: 'Querying Blockstack IDs',
    },
    make_keychain: {
      type: 'array',
      items: [
        {
          name: 'backup_phrase',
          type: 'string',
          realtype: '12_words_or_ciphertext',
        },
      ],
      minItems: 0,
      maxItems: 1,
      help:
        'Generate the owner and payment private keys, optionally from a given 12-word ' +
        'backup phrase.  If no backup phrase is given, a new one will be generated.  If you provide ' +
        'your encrypted backup phrase, you will be asked to decrypt it.\n' +
        '\n' +
        'Example:\n' +
        '\n' +
        '    $ stx make_keychain\n' +
        '    {\n' +
        '      "mnemonic": "apart spin rich leader siren foil dish sausage fee pipe ethics bundle",\n' +
        '      "keyInfo": {\n' +
        '        "privateKey": "25899fab1b9b95cc2d1692529f00fb788e85664df3d14db1a660f33c5f96d8ab01"\n' +
        '        "address": "SP3RBZ4TZ3EK22SZRKGFZYBCKD7WQ5B8FFS0AYVF7"\n' +
        '        "btcAddress": "1Nwxfx7VoYAg2mEN35dTRw4H7gte8ajFki"\n' +
        '        "wif": "KxUgLbeVeFZEUUQpc3ncYn5KFB3WH5MVRv3SJ2g5yPwkrXs3QRaP"\n' +
        '        "index": 0,\n' +
        '      }\n' +
        '    }\n' +
        '\n',
      group: 'Key Management',
    },
    make_zonefile: {
      type: 'array',
      items: [
        {
          name: 'blockstack_id',
          type: 'string',
          realtype: 'blockstack_id',
          pattern: `^${NAME_PATTERN}|${SUBDOMAIN_PATTERN}$`,
        },
        {
          name: 'id_address',
          type: 'string',
          realtype: 'ID-address',
          pattern: ID_ADDRESS_PATTERN,
        },
        {
          name: 'gaia_url_prefix',
          type: 'string',
          realtype: 'url',
          pattern: '.+',
        },
        {
          name: 'resolver_url',
          type: 'string',
          realtype: 'url',
          pattern: '.+',
        },
      ],
      minItems: 3,
      maxItems: 4,
      help:
        'Generate a zone file for a Blockstack ID with the given profile URL.  If you know ' +
        'the ID-address for the Blockstack ID, the profile URL usually takes the form of:\n' +
        '\n' +
        '     {GAIA_URL_PREFIX}/{ADDRESS}/profile.json\n' +
        '\n' +
        'where `{GAIA_URL_PREFIX}` is the *read* endpoint of your Gaia hub (e.g. https://gaia.blockstack.org/hub) and ' +
        "`{ADDRESS}` is the base58check part of your ID-address (i.e. the string following 'ID-').\n" +
        '\n' +
        'Example:\n' +
        '\n' +
        '     $ stx make_zonefile example.id ID-1ArdkA2oLaKnbNbLccBaFhEV4pYju8hJ82 https://my.gaia.hub/hub\n' +
        '     $ORIGIN example.id\n' +
        '     $TTL 3600\n' +
        '     _http._tcp      IN      URI     10      1       "https://my.gaia.hub/hub/1ArdkA2oLaKnbNbLccBaFhEV4pYju8hJ82/profile.json"\n' +
        '\n',
      group: 'Peer Services',
    },
    name_import: {
      type: 'array',
      items: [
        {
          name: 'blockstack_id',
          type: 'string',
          realtype: 'blockstack_id',
          pattern: NAME_PATTERN,
        },
        {
          name: 'id_address',
          type: 'string',
          realtype: 'id-address',
          pattern: ID_ADDRESS_PATTERN,
        },
        {
          name: 'gaia_url_prefix',
          type: 'string',
          realtype: 'url',
          pattern: '.+',
        },
        {
          name: 'reveal_key',
          type: 'string',
          realtype: 'private_key',
          pattern: `${PRIVATE_KEY_PATTERN_ANY}`,
        },
        {
          name: 'zonefile',
          type: 'string',
          realtype: 'path',
          pattern: '.+',
        },
        {
          name: 'zonefile_hash',
          type: 'string',
          realtype: 'zonefile_hash',
          pattern: ZONEFILE_HASH_PATTERN,
        },
      ],
      minItems: 4,
      maxItems: 6,
      help:
        'Import a name into a namespace you revealed.  The `REVEAL_KEY` must be the same as ' +
        'the key that revealed the namespace.  You can only import a name into a namespace if ' +
        'the namespace has not yet been launched (i.e. via `namespace_ready`), and if the ' +
        'namespace was revealed less than a year ago (52595 blocks ago).\n' +
        '\n' +
        'A zone file will be generated for this name automatically, if "ZONEFILE" is not given.  By default, ' +
        "the zone file will have a URL to the name owner's profile prefixed by `GAIA_URL_PREFIX`.  If you " +
        "know the *write* endpoint for the name owner's Gaia hub, you can find out the `GAIA_URL_PREFIX` " +
        'to use with `curl $GAIA_HUB/hub_info`".\n' +
        '\n' +
        'If you specify an argument for `ZONEFILE`, then the `GAIA_URL_PREFIX` argument is ignored in favor of ' +
        'your custom zone file on disk.\n' +
        '\n' +
        'If you specify a valid zone file hash for `ZONEFILE_HASH` then it will be used in favor of ' +
        'both `ZONEFILE` and `GAIA_URL_PREFIX`.  The zone file hash will be incorporated directly into the ' +
        'name-import transaction.\n' +
        '\n' +
        'This command prints out a transaction ID if it succeeds, and it replicates the zone file (if given) ' +
        'to a transaction broadcaster (you can choose which one with -T).  The zone file will be automatically ' +
        'broadcast to the Blockstack peer network when the transaction confirms.  Alternatively, you can do so ' +
        'yourself with the `zonefile_push` command.\n' +
        '\n' +
        'Example:\n' +
        '\n' +
        '    $ export REVEAL_KEY="bfeffdf57f29b0cc1fab9ea197bb1413da2561fe4b83e962c7f02fbbe2b1cd5401"\n' +
        '    $ export ID_ADDRESS="ID-18e1bqU7B5qUPY3zJgMLxDnexyStTeSnvV"\n' +
        '    $ stx name_import example.id "$ID_ADDRESS" https://gaia.blockstack.org/hub "$REVEAL_KEY"\n' +
        '    f726309cea7a9db364307466dc0e0e759d5c0d6bad1405e2fd970740adc7dc45\n' +
        '\n',
      group: 'Namespace Operations',
    },
    namespace_preorder: {
      type: 'array',
      items: [
        {
          name: 'namespace_id',
          type: 'string',
          realtype: 'namespace_id',
          pattern: NAMESPACE_PATTERN,
        },
        {
          name: 'reveal_address',
          type: 'string',
          realtype: 'address',
          pattern: ADDRESS_PATTERN,
        },
        {
          name: 'payment_key',
          type: 'string',
          realtype: 'private_key',
          pattern: `${PRIVATE_KEY_PATTERN_ANY}`,
        },
      ],
      minItems: 3,
      maxItems: 3,
      help:
        'Preorder a namespace.  This is the first of three steps to creating a namespace.  ' +
        'Once this transaction is confirmed, you will need to use the `namespace_reveal` command ' +
        'to reveal the namespace (within 24 hours, or 144 blocks).',
      group: 'Namespace Operations',
    },
    namespace_reveal: {
      type: 'array',
      items: [
        {
          name: 'namespace_id',
          type: 'string',
          realtype: 'namespace_id',
          pattern: NAMESPACE_PATTERN,
        },
        {
          name: 'reveal_address',
          type: 'string',
          realtype: 'address',
          pattern: ADDRESS_PATTERN,
        },
        {
          // version
          name: 'version',
          type: 'string',
          realtype: '2-byte-integer',
          pattern: INT_PATTERN,
        },
        {
          // lifetime
          name: 'lifetime',
          type: 'string',
          realtype: '4-byte-integer',
          pattern: INT_PATTERN,
        },
        {
          // coeff
          name: 'coefficient',
          type: 'string',
          realtype: '1-byte-integer',
          pattern: INT_PATTERN,
        },
        {
          // base
          name: 'base',
          type: 'string',
          realtype: '1-byte-integer',
          pattern: INT_PATTERN,
        },
        {
          // buckets
          name: 'price_buckets',
          type: 'string',
          realtype: 'csv-of-16-nybbles',
          pattern: '^([0-9]{1,2},){15}[0-9]{1,2}$',
        },
        {
          // non-alpha discount
          name: 'nonalpha_discount',
          type: 'string',
          realtype: 'nybble',
          pattern: INT_PATTERN,
        },
        {
          // no-vowel discount
          name: 'no_vowel_discount',
          type: 'string',
          realtype: 'nybble',
          pattern: INT_PATTERN,
        },
        {
          name: 'payment_key',
          type: 'string',
          realtype: 'private_key',
          pattern: `${PRIVATE_KEY_PATTERN_ANY}`,
        },
      ],
      minItems: 10,
      maxItems: 10,
      help:
        'Reveal a preordered namespace, and set the price curve and payment options.  ' +
        'This is the second of three steps required to create a namespace, and must be done ' +
        'shortly after the associated `namespace_preorder` command.',
      group: 'Namespace Operations',
    },
    namespace_ready: {
      type: 'array',
      items: [
        {
          name: 'namespace_id',
          type: 'string',
          realtype: 'namespace_id',
          pattern: NAMESPACE_PATTERN,
        },
        {
          name: 'reveal_key',
          type: 'string',
          realtype: 'private_key',
          pattern: `${PRIVATE_KEY_PATTERN_ANY}`,
        },
      ],
      minItems: 2,
      maxItems: 2,
      help:
        'Launch a revealed namespace.  This is the third and final step of creating a namespace.  ' +
        'Once launched, you will not be able to import names anymore.',
      group: 'Namespace Operations',
    },
    price: {
      type: 'array',
      items: [
        {
          name: 'blockstack_id',
          type: 'string',
          realtype: 'blockstack_id',
          pattern: NAME_PATTERN,
        },
      ],
      minItems: 1,
      maxItems: 1,
      help:
        'Get the price of an on-chain Blockstack ID.  Its namespace must already exist.\n' +
        '\n' +
        'Example:\n' +
        '\n' +
        '    $ stx price example.id\n' +
        '    {\n' +
        '      "units": "BTC",\n' +
        '      "amount": "5500"\n' +
        '    }\n' +
        '\n',
      group: 'Querying Blockstack IDs',
    },
    price_namespace: {
      type: 'array',
      items: [
        {
          name: 'namespace_id',
          type: 'string',
          realtype: 'namespace_id',
          pattern: NAMESPACE_PATTERN,
        },
      ],
      minItems: 1,
      maxItems: 1,
      help:
        'Get the price of a namespace.\n' +
        '\n' +
        'Example:\n' +
        '\n' +
        '    $ # get the price of the .hello namespace\n' +
        '    $ stx price_namespace hello\n' +
        '    {\n' +
        '      "units": "BTC",\n' +
        '      "amount": "40000000"\n' +
        '    }\n' +
        '\n',
      group: 'Namespace Operations',
    },
    profile_sign: {
      type: 'array',
      items: [
        {
          name: 'profile',
          type: 'string',
          realtype: 'path',
        },
        {
          name: 'owner_key',
          type: 'string',
          realtype: 'private_key',
          pattern: PRIVATE_KEY_PATTERN,
        },
      ],
      minItems: 2,
      maxItems: 2,
      help:
        'Sign a profile on disk with a given owner private key.  Print out the signed profile JWT.\n' +
        '\n' +
        'Example:\n' +
        '\n' +
        '    $ # Tip: you can get the owner key from your 12-word backup phrase using the get_owner_keys command\n' +
        '    $ stx profile_sign /path/to/profile.json 0ffd299af9c257173be8486ef54a4dd1373407d0629ca25ca68ff24a76be09fb01\n' +
        '\n',
      group: 'Profiles',
    },
    profile_store: {
      type: 'array',
      items: [
        {
          name: 'user_id',
          type: 'string',
          realtype: 'name-or-id-address',
          pattern: `${NAME_PATTERN}|${SUBDOMAIN_PATTERN}|${ID_ADDRESS_PATTERN}`,
        },
        {
          name: 'profile',
          type: 'string',
          realtype: 'path',
        },
        {
          name: 'owner_key',
          type: 'string',
          realtype: 'private_key',
          pattern: PRIVATE_KEY_PATTERN,
        },
        {
          name: 'gaia_hub',
          type: 'string',
          realtype: 'url',
        },
      ],
      minItems: 4,
      maxItems: 4,
      help:
        'Store a profile on disk to a Gaia hub.  `USER_ID` can be either a Blockstack ID or ' +
        "an ID-address.  The `GAIA_HUB` argument must be the *write* endpoint for the user's Gaia hub " +
        '(e.g. https://hub.blockstack.org).  You can verify this by ensuring that you can run ' +
        '`curl "$GAIA_HUB/hub_info"` successfully.',
      group: 'Profiles',
    },
    profile_verify: {
      type: 'array',
      items: [
        {
          name: 'profile',
          type: 'string',
          realtype: 'path',
        },
        {
          name: 'id_address',
          type: 'string',
          realtype: 'id-address',
          pattern: `${ID_ADDRESS_PATTERN}|${PUBLIC_KEY_PATTERN}`,
        },
      ],
      minItems: 2,
      maxItems: 2,
      help:
        'Verify a JWT encoding a profile on disk using an ID-address.  Prints out the contained profile on success.\n' +
        '\n' +
        'Example:\n' +
        '\n' +
        '    $ # get the raw profile JWT\n' +
        '    $ curl -sL https://raw.githubusercontent.com/jcnelson/profile/master/judecn.id > /tmp/judecn.id.jwt\n' +
        '    $ # Tip: you can get the ID-address for a name with the "whois" command\n' +
        '    $ stx profile_verify /tmp/judecn.id.jwt ID-16EMaNw3pkn3v6f2BgnSSs53zAKH4Q8YJg\n' +
        '\n',
      group: 'Profiles',
    },
    renew: {
      type: 'array',
      items: [
        {
          name: 'blockstack_id',
          type: 'string',
          realtype: 'on-chain-blockstack_id',
          pattern: NAME_PATTERN,
        },
        {
          name: 'owner_key',
          type: 'string',
          realtype: 'private_key',
          pattern: `${PRIVATE_KEY_PATTERN_ANY}`,
        },
        {
          name: 'payment_key',
          type: 'string',
          realtype: 'private_key',
          pattern: `${PRIVATE_KEY_PATTERN_ANY}`,
        },
        {
          name: 'new_id_address',
          type: 'string',
          realtype: 'id-address',
          pattern: ID_ADDRESS_PATTERN,
        },
        {
          name: 'zonefile',
          type: 'string',
          realtype: 'path',
        },
        {
          name: 'zonefile_hash',
          type: 'string',
          realtype: 'zonefile_hash',
          pattern: ZONEFILE_HASH_PATTERN,
        },
      ],
      minItems: 3,
      maxItems: 6,
      help:
        'Renew a name.  Optionally transfer it to a new owner address (`NEW_ID_ADDRESS`), ' +
        'and optionally load up and give it a new zone file on disk (`ZONEFILE`).  If the command ' +
        'succeeds, it prints out a transaction ID.  You can use with the `get_confirmations` ' +
        'command to track its confirmations on the underlying blockchain -- once it reaches 7 ' +
        'confirmations, the rest of the Blockstack peer network will process it.\n' +
        '\n' +
        'If you create a new zonefile for your name, you will need ' +
        'to later use `zonefile_push` to replicate the zone file to the Blockstack peer network ' +
        'once the transaction reaches 7 confirmations.\n' +
        '\n' +
        'Example:\n' +
        '\n' +
        '    $ # Tip: you can get your owner key from your backup phrase with "get_owner_keys".\n' +
        '    $ # Tip: you can get your payment key from your backup phrase with "get_payment_key".\n' +
        '    $ export OWNER="136ff26efa5db6f06b28f9c8c7a0216a1a52598045162abfe435d13036154a1b01"\n' +
        '    $ export PAYMENT="bfeffdf57f29b0cc1fab9ea197bb1413da2561fe4b83e962c7f02fbbe2b1cd5401"\n' +
        '    $ stx renew hello_world.id "$OWNER" "$PAYMENT"\n' +
        '    3d8945ce76d4261678d76592b472ed639a10d4298f9d730af4edbbc3ec02882e\n' +
        '\n' +
        '    $ # Renew with a new owner\n' +
        '    $ export NEW_OWNER="ID-141BcmFVbEuuMb7Bd6umXyV6ZD1WYomYDE"\n' +
        '    $ stx renew hello_world.id "$OWNER" "$PAYMENT" "$NEW_OWNER"\n' +
        '    33865625ef3f1b607111c0dfba9e58604927173bd2e299a343e19aa6d2cfb263\n' +
        '\n' +
        '    $ # Renew with a new zone file.\n' +
        '    $ # Tip: you can create a new zonefile with the "make_zonefile" command.\n' +
        '    $ export ZONEFILE_PATH="/path/to/new/zonefile.txt"\n' +
        '    $ stx renew hello_world.id "$OWNER" "$PAYMENT" --zonefile "$ZONEFILE_PATH"\n' +
        '    e41ce043ab64fd5a5fd382fba21acba8c1f46cbb1d7c08771ada858ce7d29eea\n' +
        '    $ # wait 7 confirmations\n' +
        '    $ stx get_confirmations e41ce043ab64fd5a5fd382fba21acba8c1f46cbb1d7c08771ada858ce7d29eea\n' +
        '    {\n' +
        '      "blockHeight": 567890,\n' +
        '      "confirmations": 7,\n' +
        '    }\n' +
        '    $ stx -H https://core.blockstack.org zonefile_push "$ZONEFILE_PATH"\n' +
        '    [\n' +
        '      "https://core.blockstack.org"\n' +
        '    ]\n' +
        '\n',
      group: 'Blockstack ID Management',
    },
    register: {
      type: 'array',
      items: [
        {
          name: 'blockstack_id',
          type: 'string',
          realtype: 'on-chain-blockstack_id',
          pattern: NAME_PATTERN,
        },
        {
          name: 'owner_key',
          type: 'string',
          realtype: 'private_key',
          pattern: PRIVATE_KEY_PATTERN,
        },
        {
          name: 'payment_key',
          type: 'string',
          realtype: 'private_key',
          pattern: `${PRIVATE_KEY_PATTERN_ANY}`,
        },
        {
          name: 'gaia_hub',
          type: 'string',
          realtype: 'url',
        },
        {
          name: 'zonefile',
          type: 'string',
          realtype: 'path',
        },
      ],
      minItems: 4,
      maxItems: 5,
      help:
        'If you are trying to register a name for a *private key*, use this command.\n' +
        '\n' +
        'Register a name to a single name-owning private key.  After successfully running this command, ' +
        'and after waiting a couple hours, your name will be ready to use and will resolve to a ' +
        'signed empty profile hosted on the given Gaia hub (`GAIA_HUB`).\n' +
        '\n' +
        'Behind the scenes, this will generate and send two transactions ' +
        'and generate and replicate a zone file with the given Gaia hub URL (`GAIA_HUB`).  ' +
        'Note that the `GAIA_HUB` argument must correspond to the *write* endpoint of the Gaia hub ' +
        '(i.e. you should be able to run \'curl "$GAIA_HUB/hub_info"\' and get back data).  If you ' +
        'are using Blockstack PBC\'s default Gaia hub, pass "https://hub.blockstack.org" for this ' +
        'argument.\n' +
        '\n' +
        "By default, this command generates a zone file automatically that points to the Gaia hub's " +
        'read endpoint (which is queried on-the-fly from `GAIA_HUB`).  If you instead want to have a custom zone file for this name, ' +
        'you can specify a path to it on disk with the `ZONEFILE` argument.\n' +
        '\n' +
        'If this command completes successfully, your name will be ready to use once both transactions have 7+ confirmations.  ' +
        'You can use the `get_confirmations` command to track the confirmations ' +
        'on the transaction IDs returned by this command.\n' +
        '\n' +
        'WARNING: You should *NOT* use the payment private key (`PAYMENT_KEY`) while the name is being confirmed.  ' +
        'If you do so, you could double-spend one of the pending transactions and lose your name.\n' +
        '\n' +
        'Example:\n' +
        '\n' +
        '    $ export OWNER="136ff26efa5db6f06b28f9c8c7a0216a1a52598045162abfe435d13036154a1b01"\n' +
        '    $ export PAYMENT="bfeffdf57f29b0cc1fab9ea197bb1413da2561fe4b83e962c7f02fbbe2b1cd5401"\n' +
        '    $ stx register example.id "$OWNER" "$PAYMENT" https://hub.blockstack.org\n' +
        '    9bb908bfd4ab221f0829167a461229172184fc825a012c4e551533aa283207b1\n' +
        '\n',
      group: 'Blockstack ID Management',
    },
    register_addr: {
      type: 'array',
      items: [
        {
          name: 'blockstack_id',
          type: 'string',
          realtype: 'blockstack_id',
          pattern: NAME_PATTERN,
        },
        {
          name: 'id-address',
          type: 'string',
          realtype: 'id-address',
          pattern: ID_ADDRESS_PATTERN,
        },
        {
          name: 'payment_key',
          type: 'string',
          realtype: 'private_key',
          pattern: `${PRIVATE_KEY_PATTERN_ANY}`,
        },
        {
          name: 'gaia_url_prefix',
          type: 'string',
          realtype: 'url',
        },
        {
          name: 'zonefile',
          type: 'string',
          realtype: 'path',
        },
      ],
      minItems: 4,
      maxItems: 5,
      help:
        'If you are trying to register a name for an *ID-address*, use this command.\n' +
        '\n' +
        "Register a name to someone's ID-address.  After successfully running this " +
        'command and waiting a couple of hours, the name will be registered on-chain and have a ' +
        "zone file with a URL to where the owner's profile should be.  This command does NOT " +
        'generate, sign, or replicate a profile for the name---the name owner will need to do this ' +
        'separately, once the name is registered.\n' +
        '\n' +
        'Behind the scenes, this command will generate two ' +
        'transactions, and generate and replicate a zone file with the given Gaia hub read URL ' +
        '(`GAIA_URL_PREFIX`).  Note that the `GAIA_URL_PREFIX` argument must correspond to the *read* endpoint of the Gaia hub ' +
        '(e.g. if you are using Blockstack PBC\'s default Gaia hub, this is "https://gaia.blockstack.org/hub"). ' +
        "If you know the *write* endpoint of the name owner's Gaia hub, you can find the right value for " +
        '`GAIA_URL_PREFIX` by running "curl $GAIA_HUB/hub_info".\n' +
        '\n' +
        'No profile will be generated or uploaded by this command.  Instead, this command generates ' +
        'a zone file that will include the URL to a profile based on the `GAIA_URL_PREFIX` argument.\n' +
        '\n' +
        'The zone file will be generated automatically from the `GAIA_URL_PREFIX` argument.  If you need ' +
        'to use a custom zone file, you can pass the path to it on disk via the `ZONEFILE` argument.\n' +
        '\n' +
        'If this command completes successfully, the name will be ready to use in a couple of ' +
        'hours---that is, once both transactions have 7+ confirmations. ' +
        'You can use the `get_confirmations` command to track the confirmations.\n' +
        '\n' +
        'WARNING: You should *NOT* use the payment private key (`PAYMENT_KEY`) while the name is being confirmed.  ' +
        'If you do so, you could double-spend one of the pending transactions and lose the name.\n' +
        '\n' +
        'Example:\n' +
        '\n' +
        '    $ export ID_ADDRESS="ID-18e1bqU7B5qUPY3zJgMLxDnexyStTeSnvV"\n' +
        '    $ export PAYMENT="bfeffdf57f29b0cc1fab9ea197bb1413da2561fe4b83e962c7f02fbbe2b1cd5401"\n' +
        '    $ stx register_addr example.id "$ID_ADDRESS" "$PAYMENT" https://gaia.blockstack.org/hub',
      group: 'Blockstack ID Management',
    },
    register_subdomain: {
      type: 'array',
      items: [
        {
          name: 'blockstack_id',
          type: 'string',
          realtype: 'blockstack_id',
          pattern: SUBDOMAIN_PATTERN,
        },
        {
          name: 'owner_key',
          type: 'string',
          realtype: 'private_key',
          pattern: PRIVATE_KEY_PATTERN,
        },
        {
          name: 'gaia_hub',
          type: 'string',
          realtype: 'url',
        },
        {
          name: 'registrar',
          type: 'string',
          realtype: 'url',
        },
        {
          name: 'zonefile',
          type: 'string',
          realtype: 'path',
        },
      ],
      minItems: 4,
      maxItems: 5,
      help:
        'Register a subdomain.  This will generate and sign a subdomain zone file record ' +
        'with the given `GAIA_HUB` URL and send it to the given subdomain registrar (`REGISTRAR`).\n' +
        '\n' +
        'This command generates, signs, and uploads a profile to the `GAIA_HUB` url.  Note that the `GAIA_HUB` ' +
        'argument must correspond to the *write* endpoint of your Gaia hub (i.e. you should be able ' +
        "to run 'curl \"$GAIA_HUB/hub_info\"' successfully).  If you are using Blockstack PBC's default " +
        'Gaia hub, this argument should be "https://hub.blockstack.org".\n' +
        '\n' +
        'WARNING: At this time, no validation will occur on the registrar URL.  Be sure that the URL ' +
        'corresponds to the registrar for the on-chain name before running this command!\n' +
        '\n' +
        'Example:\n' +
        '\n' +
        '    $ export OWNER="6e50431b955fe73f079469b24f06480aee44e4519282686433195b3c4b5336ef01"\n' +
        '    $ # NOTE: https://registrar.blockstack.org is the registrar for personal.id!\n' +
        '    $ stx register_subdomain hello.personal.id "$OWNER" https://hub.blockstack.org https://registrar.blockstack.org\n',
      group: 'Blockstack ID Management',
    },
    revoke: {
      type: 'array',
      items: [
        {
          name: 'blockstack_id',
          type: 'string',
          realtype: 'on-chain-blockstack_id',
          pattern: NAME_PATTERN,
        },
        {
          name: 'owner_key',
          type: 'string',
          realtype: 'private_key',
          pattern: `${PRIVATE_KEY_PATTERN_ANY}`,
        },
        {
          name: 'payment_key',
          type: 'string',
          realtype: 'private_key',
          pattern: `${PRIVATE_KEY_PATTERN_ANY}`,
        },
      ],
      minItems: 3,
      maxItems: 3,
      help:
        'Revoke a name.  This renders it unusable until it expires (if ever).  This command ' +
        'prints out the transaction ID if it succeeds.  Once the transaction confirms, the name will ' +
        'be revoked by each node in the peer network.  This command only works for on-chain names, not ' +
        'subdomains.\n' +
        '\n' +
        'Example:\n' +
        '\n' +
        '    $ # Tip: you can get your owner and payment keys from your 12-word backup phrase using the get_owner_keys and get_payment_key commands.\n' +
        '    $ export OWNER="6e50431b955fe73f079469b24f06480aee44e4519282686433195b3c4b5336ef01"\n' +
        '    $ export PAYMENT="bfeffdf57f29b0cc1fab9ea197bb1413da2561fe4b83e962c7f02fbbe2b1cd5401"\n' +
        '    $ stx revoke example.id "$OWNER" "$PAYMENT"\n' +
        '    233b559c97891affa010567bd582110508d0236b4e3f88d3b1d0731629e030b0\n' +
        '\n',
      group: 'Blockstack ID Management',
    },
    send_btc: {
      type: 'array',
      items: [
        {
          name: 'recipient_address',
          type: 'string',
          realtype: 'address',
          pattern: ADDRESS_PATTERN,
        },
        {
          name: 'amount',
          type: 'string',
          realtype: 'satoshis',
          pattern: INT_PATTERN,
        },
        {
          name: 'payment_key',
          type: 'string',
          realtype: 'private_key',
          pattern: `${PRIVATE_KEY_PATTERN_ANY}`,
        },
      ],
      minItems: 3,
      maxItems: 3,
      help:
        'Send some Bitcoin (in satoshis) from a payment key to an address.  Up to the given ' +
        'amount will be spent, but likely less---the actual amount sent will be the amount given, ' +
        'minus the transaction fee.  For example, if you want to send 10000 satoshis but the ' +
        'transaction fee is 2000 satoshis, then the resulting transaction will send 8000 satoshis ' +
        'to the given address.  This is to ensure that this command does not *over*-spend your ' +
        'Bitcoin.  If you want to check the amount before spending, pass the `-x` flag to see the ' +
        'raw transaction.\n' +
        '\n' +
        'If the command succeeds, it prints out the transaction ID.  You can track its confirmations ' +
        'with the `get_confirmations` command.\n' +
        '\n' +
        'Example:\n' +
        '\n' +
        '    $ export PAYMENT="bfeffdf57f29b0cc1fab9ea197bb1413da2561fe4b83e962c7f02fbbe2b1cd5401"\n' +
        '    $ stx send_btc 18qTSE5PPQmypwKKej7QX5Db2XAttgYeA1 123456 "$PAYMENT"\n' +
        '    c7e239fd24da30e36e011e6bc7db153574a5b40a3a8dc3b727adb54ad038acc5\n' +
        '\n',
      group: 'Account Management',
    },
    send_tokens: {
      type: 'array',
      items: [
        {
          name: 'address',
          type: 'string',
          realtype: 'address',
          pattern: STACKS_ADDRESS_PATTERN,
        },
        {
          name: 'amount',
          type: 'string',
          realtype: 'integer',
          pattern: '^[0-9]+$',
        },
        {
          name: 'fee',
          type: 'string',
          realtype: 'integer',
          pattern: '^[0-9]+$',
        },
        {
          name: 'nonce',
          type: 'string',
          realtype: 'integer',
          pattern: '^[0-9]+$',
        },
        {
          name: 'payment_key',
          type: 'string',
          realtype: 'private_key',
          pattern: `${PRIVATE_KEY_PATTERN_ANY}`,
        },
        {
          name: 'memo',
          type: 'string',
          realtype: 'string',
          pattern: '^.{0,34}$',
        },
      ],
      minItems: 5,
      maxItems: 6,
      help:
        'Send a particular type of tokens to the given `ADDRESS`.  Right now, only supported `TOKEN-TYPE` is `STACKS`.  Optionally ' +
        'include a memo string (`MEMO`) up to 34 characters long.\n' +
        '\n' +
        'If the command succeeds, it prints out a transaction ID.  You can track the confirmations on the transaction ' +
        'via the `get_confirmations` command.  Once the transaction has 7 confirmations, the Blockstack peer network ' +
        'will have processed it, and your payment key balance and recipient balance will be updated.\n' +
        '\n' +
        'Example:\n' +
        '\n' +
        '    $ # check balances of sender and recipient before sending.\n' +
        '    $ # address of the key below is SP2SC16ASH76GX549PT7J5WQZA4GHMFBKYMBQFF9V\n' +
        '    $ export PAYMENT="bfeffdf57f29b0cc1fab9ea197bb1413da2561fe4b83e962c7f02fbbe2b1cd5401"\n' +
        '    $ stx balance SP2SC16ASH76GX549PT7J5WQZA4GHMFBKYMBQFF9V\n' +
        '    {\n' +
        '      "STACKS": "10000000"\n' +
        '    }\n' +
        '    $ stx balance SP1P10PS2T517S4SQGZT5WNX8R00G1ECTRKYCPMHY\n' +
        '    {\n' +
        '      "STACKS": "0"\n' +
        '    }\n' +
        '\n' +
        '    $ # send tokens\n' +
        '    $ stx send_tokens SP1P10PS2T517S4SQGZT5WNX8R00G1ECTRKYCPMHY 12345 1 0 "$PAYMENT"\n' +
        '     {\n' +
        "       txid: '0x2e33ad647a9cedacb718ce247967dc705bc0c878db899fdba5eae2437c6fa1e1'," +
        "       transaction: 'https://explorer.stacks.co/txid/0x2e33ad647a9cedacb718ce247967dc705bc0c878db899fdba5eae2437c6fa1e1'" +
        '     }\n' +
        '    a9d387a925fb0ba7a725fb1e11f2c3f1647473699dd5a147c312e6453d233456\n' +
        '\n' +
        '    $ # wait for transaction to be confirmed\n' +
        '\n' +
        '    $ stx balance SP2SC16ASH76GX549PT7J5WQZA4GHMFBKYMBQFF9V\n' +
        '    {\n' +
        '      "STACKS": "9987655"\n' +
        '    }\n' +
        '    $ stx balance SP1P10PS2T517S4SQGZT5WNX8R00G1ECTRKYCPMHY\n' +
        '    {\n' +
        '      "STACKS": "12345"\n' +
        '    }\n' +
        '\n',
      group: 'Account Management',
    },
    stack: {
      type: 'array',
      items: [
        {
          name: 'amount',
          type: 'string',
          realtype: 'integer',
          pattern: '^[0-9]+$',
        },
        {
          name: 'cycles',
          type: 'string',
          realtype: 'integer',
          pattern: '^[0-9]+$',
        },
        {
          name: 'pox_address',
          type: 'string',
          realtype: 'integer',
          pattern: `${ADDRESS_PATTERN}`,
        },
        {
          name: 'private_key',
          type: 'string',
          realtype: 'private_key',
          pattern: `${PRIVATE_KEY_PATTERN_ANY}`,
        },
        {
          name: 'fee',
          type: 'string',
          realtype: 'integer',
          pattern: '^[0-9]+$',
        },
        {
          name: 'nonce',
          type: 'string',
          realtype: 'integer',
          pattern: '^[0-9]+$',
        },
      ],
      minItems: 4,
      maxItems: 6,
      help:
        'Stack the specified number of Stacks tokens for given number of cycles.\n' +
        '\n' +
        'Example:\n' +
        '\n' +
        '    $ stx stack 10000000 20 16pm276FpJYpm7Dv3GEaRqTVvGPTdceoY4 136ff26efa5db6f06b28f9c8c7a0216a1a52598045162abfe435d13036154a1b01\n' +
        '     {\n' +
        "       txid: '0x2e33ad647a9cedacb718ce247967dc705bc0c878db899fdba5eae2437c6fa1e1'," +
        "       transaction: 'https://explorer.stacks.co/txid/0x2e33ad647a9cedacb718ce247967dc705bc0c878db899fdba5eae2437c6fa1e1'" +
        '     }\n',
      group: 'Account Management',
    },
    stacking_status: {
      type: 'array',
      items: [
        {
          name: 'pox_address',
          type: 'string',
          realtype: 'integer',
          pattern: `${STACKS_ADDRESS_PATTERN}`,
        },
      ],
      minItems: 1,
      maxItems: 1,
      help:
        'Get stacking status for specified address.\n' +
        '\n' +
        'Example:\n' +
        '\n' +
        '    $ stx stacking_status SPZY1V53Z4TVRHHW9Z7SFG8CZNRAG7BD8WJ6SXD0\n',
      group: 'Account Management',
    },
    transfer: {
      type: 'array',
      items: [
        {
          name: 'blockstack_id',
          type: 'string',
          realtype: 'on-chain-blockstack_id',
          pattern: NAME_PATTERN,
        },
        {
          name: 'new_id_address',
          type: 'string',
          realtype: 'id-address',
          pattern: ID_ADDRESS_PATTERN,
        },
        {
          name: 'keep_zonefile',
          type: 'string',
          realtype: 'true-or-false',
          pattern: '^true$|^false$',
        },
        {
          name: 'owner_key',
          type: 'string',
          realtype: 'private_key',
          pattern: `${PRIVATE_KEY_PATTERN_ANY}`,
        },
        {
          name: 'payment_key',
          type: 'string',
          realtype: 'private_key',
          pattern: `${PRIVATE_KEY_PATTERN_ANY}`,
        },
      ],
      minItems: 5,
      maxItems: 5,
      help:
        'Transfer a Blockstack ID to a new address (`NEW_ID_ADDRESS`).  Optionally preserve ' +
        'its zone file (`KEEP_ZONEFILE`).  If the command succeeds, it will print a transaction ID.  ' +
        'Once the transaction reaches 7 confirmations, the Blockstack peer network will transfer the ' +
        "Blockstack ID to the new ID-address.  You can track the transaction's confirmations with " +
        'the `get_confirmations` command.\n' +
        '\n' +
        'NOTE: This command only works for on-chain Blockstack IDs.  It does not yet work for subdomains.\n' +
        '\n' +
        'An ID-address can only own up to 25 Blockstack IDs.  In practice, you should generate a new ' +
        'owner key and ID-address for each name you receive (via the `get_owner_keys` command).\n' +
        '\n' +
        'Example:\n' +
        '\n' +
        '    $ # Tip: you can get your owner key from your backup phrase with "get_owner_keys".\n' +
        '    $ # Tip: you can get your payment key from your backup phrase with "get_payment_key".\n' +
        '    $ export OWNER="136ff26efa5db6f06b28f9c8c7a0216a1a52598045162abfe435d13036154a1b01"\n' +
        '    $ export PAYMENT="bfeffdf57f29b0cc1fab9ea197bb1413da2561fe4b83e962c7f02fbbe2b1cd5401"\n' +
        '    $ stx transfer example.id ID-1HJA1AJvWef21XbQVL2AcTv71b6JHGPfDX true "$OWNER" "$PAYMENT"\n' +
        '    e09dc158e586d0c09dbcdcba917ec394e6c6ac2b9c91c4b55f32f5973e4f08fc\n' +
        '\n',
      group: 'Blockstack ID Management',
    },
    tx_preorder: {
      type: 'array',
      items: [
        {
          name: 'blockstack_id',
          type: 'string',
          realtype: 'on-chain-blockstack_id',
          pattern: NAME_PATTERN,
        },
        {
          name: 'id_address',
          type: 'string',
          realtype: 'id-address',
          pattern: ID_ADDRESS_PATTERN,
        },
        {
          name: 'payment_key',
          type: 'string',
          realtype: 'private_key',
          pattern: `${PRIVATE_KEY_PATTERN_ANY}`,
        },
      ],
      minItems: 3,
      maxItems: 3,
      help:
        'Generate and send `NAME_PREORDER` transaction, for a Blockstack ID to be owned ' +
        'by a given `ID_ADDRESS`.  The name cost will be paid for by the gven `PAYMENT_KEY`.  The ' +
        'ID-address should be a never-before-seen address, since it will be used as a salt when ' +
        'generating the name preorder hash.\n' +
        '\n' +
        'This is a low-level command that only experienced Blockstack developers should use.  ' +
        'If you just want to register a name, use the "register" command.\n',
      group: 'Blockstack ID Management',
    },
    tx_register: {
      type: 'array',
      items: [
        {
          name: 'blockstack_id',
          type: 'string',
          realtype: 'on-chain-blockstack_id',
          pattern: NAME_PATTERN,
        },
        {
          name: 'id_address',
          type: 'string',
          realtype: 'id-address',
          pattern: ID_ADDRESS_PATTERN,
        },
        {
          name: 'payment_key',
          type: 'string',
          realtype: 'private_key',
          pattern: `${PRIVATE_KEY_PATTERN_ANY}`,
        },
        {
          name: 'zonefile',
          type: 'string',
          realtype: 'path',
        },
        {
          name: 'zonefile_hash',
          type: 'string',
          realtype: 'zoenfile_hash',
          pattern: ZONEFILE_HASH_PATTERN,
        },
      ],
      minItems: 3,
      maxItems: 5,
      help:
        'Generate and send a NAME_REGISTRATION transaction, assigning the given `BLOCKSTACK_ID` ' +
        'to the given `ID_ADDRESS`.  Optionally pair the Blockstack ID with a zone file (`ZONEFILE`) or ' +
        'the hash of the zone file (`ZONEFILE_HASH`).  You will need to push the zone file to the peer ' +
        'network after the transaction confirms (i.e. with `zonefile_push`).\n' +
        '\n' +
        'This is a low-level command that only experienced Blockstack developers should use.  If you ' +
        'just want to register a name, you should use the `register` command.',
      group: 'Blockstack ID Management',
    },
    update: {
      type: 'array',
      items: [
        {
          name: 'blockstack_id',
          type: 'string',
          realtype: 'on-chain-blockstack_id',
          pattern: NAME_PATTERN,
        },
        {
          name: 'zonefile',
          type: 'string',
          realtype: 'path',
        },
        {
          name: 'owner_key',
          type: 'string',
          realtype: 'private_key',
          pattern: `${PRIVATE_KEY_PATTERN_ANY}`,
        },
        {
          name: 'payment_key',
          type: 'string',
          realtype: 'private_key',
          pattern: `${PRIVATE_KEY_PATTERN_ANY}`,
        },
        {
          name: 'zonefile_hash',
          type: 'string',
          realtype: 'zonefile_hash',
          pattern: ZONEFILE_HASH_PATTERN,
        },
      ],
      minItems: 4,
      maxItems: 5,
      help:
        'Update the zonefile for an on-chain Blockstack ID.  You can generate a well-formed ' +
        'zone file using the `make_zonefile` command, or you can supply your own.  Zone files can be ' +
        'up to 40Kb.  Alternatively, if you only want to announce the hash of a zone file (or any ' +
        'arbitrary 20-byte hex string), you can do so by passing a value for `ZONEFILE_HASH`.  If `ZONEFILE_HASH` ' +
        'is given, then the value for `ZONEFILE` will be ignored.\n' +
        '\n' +
        'If this command succeeds, it prints out a transaction ID.  Once the transaction has 7 confirmations, ' +
        "the Blockstack peer network will set the name's zone file hash to the `RIPEMD160`(SHA256) hash of " +
        'the given zone file (or it will simply set it to the hash given in `ZONEFILE_HASH`).\n' +
        '\n' +
        'Once the transaction confirms, you will need to replicate the zone file to the Blockstack peer network.  ' +
        'This can be done with the `zonefile_push` command.  Until you do so, no Blockstack clients will be able ' +
        'to obtain the zone file announced by this command.\n' +
        '\n' +
        'Example:\n' +
        '\n' +
        '    $ # Tip: you can get your owner and payment keys from your 12-word backup phrase using the get_owner_keys and get_payment_key commands.\n' +
        '    $ export OWNER="6e50431b955fe73f079469b24f06480aee44e4519282686433195b3c4b5336ef01"\n' +
        '    $ export PAYMENT="bfeffdf57f29b0cc1fab9ea197bb1413da2561fe4b83e962c7f02fbbe2b1cd5401"\n' +
        '    $ # make a new zone file\n' +
        '    $ stx make_zonefile example.id ID-1ArdkA2oLaKnbNbLccBaFhEV4pYju8hJ82 https://my.gaia.hub/hub > /tmp/zonefile.txt\n' +
        '    \n' +
        '    $ # update the name to reference this new zone file\n' +
        '    $ stx update example.id /tmp/zonefile.txt "$OWNER" "$PAYMENT"\n' +
        '    8e94a5b6647276727a343713d3213d587836e1322b1e38bc158406f5f8ebe3fd\n' +
        '    \n' +
        '    $ # check confirmations\n' +
        '    $ stx get_confirmations e41ce043ab64fd5a5fd382fba21acba8c1f46cbb1d7c08771ada858ce7d29eea\n' +
        '    {\n' +
        '      "blockHeight": 567890,\n' +
        '      "confirmations": 7,\n' +
        '    }\n' +
        '    \n' +
        '    $ # send out the new zone file to a Blockstack peer\n' +
        '    $ stx -H https://core.blockstack.org zonefile_push /tmp/zonefile.txt\n' +
        '    [\n' +
        '      "https://core.blockstack.org"\n' +
        '    ]\n' +
        '\n',
      group: 'Blockstack ID Management',
    },
    whois: {
      type: 'array',
      items: [
        {
          name: 'blockstack_id',
          type: 'string',
          realtype: 'blockstack_id',
          pattern: NAME_PATTERN + '|' + SUBDOMAIN_PATTERN,
        },
      ],
      minItems: 1,
      maxItems: 1,
      help:
        'Look up the zone file and owner of a Blockstack ID.  Works with both on-chain and off-chain names.\n' +
        '\n' +
        'Example:\n' +
        '\n' +
        '    $ stx whois example.id\n' +
        '    {\n' +
        '      "address": "1ArdkA2oLaKnbNbLccBaFhEV4pYju8hJ82",\n' +
        '      "block_renewed_at": 567890,\n' +
        '      "blockchain": "bitcoin",\n' +
        '      "expire_block": 687010,\n' +
        '      "grace_period": false,\n' +
        '      "last_transaction_height": "567891",\n' +
        '      "last_txid": "a564aa482ee43eb2bdfb016e01ea3b950bab0cfa39eace627d632e73c7c93e48",\n' +
        '      "owner_script": "76a9146c1c2fc3cf74d900c51e9b5628205130d7b98ae488ac",\n' +
        '      "renewal_deadline": 692010,\n' +
        '      "resolver": null,\n' +
        '      "status": "registered",\n' +
        '      "zonefile": "$ORIGIN example.id\\n$TTL 3600\\n_http._tcp URI 10 1 \\"https://gaia.blockstack.org/hub/1ArdkA2oLaKnbNbLccBaFhEV4pYju8hJ82/profile.json\\"\\n",\n' +
        '      "zonefile_hash": "ae4ee8e7f30aa890468164e667e2c203266f726e"\n' +
        '    }\n' +
        '\n',
      group: 'Querying Blockstack IDs',
    },
    zonefile_push: {
      type: 'array',
      items: [
        {
          name: 'zonefile',
          type: 'string',
          realtype: 'path',
        },
      ],
      minItems: 1,
      maxItems: 1,
      help:
        'Push a zone file on disk to the Blockstack peer network.  The zone file must ' +
        'correspond to a zone file hash that has already been announced.  That is, you use this command ' +
        'in conjunction with the `register`, `update`, `renew`, or `name_import` commands.\n' +
        '\n' +
        'Example:\n' +
        '\n' +
        '    $ stx -H https://core.blockstack.org zonefile_push /path/to/zonefile.txt\n' +
        '    [\n' +
        '      "https://core.blockstack.org"\n' +
        '    ]\n' +
        '\n',
      group: 'Peer Services',
    },
    get_did_configuration: {
      type: 'array',
      items: [
        {
          name: 'blockstack_id',
          type: 'string',
          realtype: 'blockstack_id',
          pattern: NAME_PATTERN + '|' + SUBDOMAIN_PATTERN,
        },
        {
          name: 'domain',
          type: 'string',
          realtype: 'domain',
          pattern: NAME_PATTERN + '|' + SUBDOMAIN_PATTERN,
        },
        {
          name: 'owner_key',
          type: 'string',
          realtype: 'private_key',
          pattern: `${PRIVATE_KEY_PATTERN}`,
        },
      ],
      minItems: 3,
      maxItems: 3,
      help:
        'Creates a DID configuration for the given blockstack id and domain to create a link between both.' +
        'The specification is define by the Decentralized Identity Foundation at https://identity.foundation/specs/did-configuration/\n' +
        'The DID configuration should be placed in the json file ".well_known/did_configuration"' +
        '\n' +
        'Example:\n' +
        '\n' +
        '    $ # Tip: you can get your owner keys from your 12-word backup phrase using the get_owner_keys command.\n' +
        '    $ export PRIVATE_OWNER_KEY="6e50431b955fe73f079469b24f06480aee44e4519282686433195b3c4b5336ef01"\n' +
        '    $ stx get_did_configuration public_profile_for_testing.id.blockstack helloblockstack.com PRIVATE_OWNER_KEY\n' +
        '    {\n' +
        '       "entries": [\n' +
        '          {\n' +
        '            "did": "did:stack:v0:SewTRvPZUEQGdr45QvEnVMGHZBhx3FT1Jj-0",\n' +
        '            "jwt": "eyJ0eXAiOiJKV1QiL...."\n' +
        '          }\n' +
        '       ]\n' +
        '    }\n' +
        '\n' +
        'The decoded content of the jwt above is \n' +
        '    {\n' +
        '       "header": {\n' +
        '          "typ": "JWT", "alg": "ES256K"\n' +
        '       },\n' +
        '       "payload": {\n' +
        '           "iss": "did:stack:v0:SewTRvPZUEQGdr45QvEnVMGHZBhx3FT1Jj-0",\n' +
        '           "domain": "helloblockstack.com",\n' +
        '           "exp": "2020-12-07T13:05:28.375Z"\n' +
        '       },\n' +
        '       "signature": "NDY7ISzgAHKcZDvbxzTxQdVnf6xWMZ46w5vHcDpNx_1Fsyip0M6E6GMq_2YZ-gUcwmwlo8Ag9jgnfOkaBIFpoQ"\n' +
        '    }\n' +
        '\n',
      group: 'DID',
    },
  } as CLI_PROP,
  additionalProperties: false,
  strict: true,
};

// usage string for built-in options
export const USAGE = `Usage: ${process.argv[1]} [options] command [command arguments]
Options can be:
    -c                  Path to a config file (defaults to
                        ${DEFAULT_CONFIG_PATH})

    -d                  Print verbose debugging output

    -e                  Estimate the BTC cost of an transaction (in satoshis).
                        Do not generate or send any transactions.

    -m MAGIC_BYTES      Use an alternative magic byte string instead of "id".

    -t                  Use the public testnet instead of mainnet.

    -l                  Use the local testnet instead of mainnet.

    -i                  Use integration test framework instead of mainnet.

    -U                  Unsafe mode.  No safety checks will be performed.

    -x                  Do not broadcast a transaction.  Only generate and
                        print them to stdout.

    -B BURN_ADDR        Use the given namespace burn address instead of the one
                        obtained from the Blockstack network (DANGEROUS)

    -D DENOMINATION     Denominate the price to pay in the given units
                        (DANGEROUS)

    -C CONSENSUS_HASH   Use the given consensus hash instead of one obtained
                        from the network

    -F FEE_RATE         Use the given transaction fee rate instead of the one
                        obtained from the Bitcoin network

    -G GRACE_PERIOD     Number of blocks in which a name can be renewed after it
                        expires (DANGEROUS)

    -H URL              Use an alternative Blockstack Core API endpoint.

    -I URL              Use an alternative Blockstack Core Indexer endpoint.

    -M MAX_INDEX        Maximum keychain index to use when searching for an identity address
                        (default is ${DEFAULT_MAX_ID_SEARCH_INDEX}).

    -N PAY2NS_PERIOD    Number of blocks in which a namespace receives the registration
                        and renewal fees after it is created (DANGEROUS)

    -P PRICE            Use the given price to pay for names or namespaces
                        (DANGEROUS)

    -T URL              Use an alternative Blockstack transaction broadcaster.

    -X URL              Use an alternative UTXO service endpoint.

    -u USERNAME         A username to be passed to bitcoind RPC endpoints

    -p PASSWORD         A password to be passed to bitcoind RPC endpoints
`;

/*
 * Format help
 */
function formatHelpString(indent: number, limit: number, helpString: string): string {
  const lines = helpString.split('\n');
  let buf = '';
  let pad = '';
  for (let i = 0; i < indent; i++) {
    pad += ' ';
  }

  for (let i = 0; i < lines.length; i++) {
    let linebuf = pad.slice();
    const words = lines[i].split(/ /).filter(word => word.length > 0);
    if (words.length == 0) {
      buf += '\n';
      continue;
    }

    if (words[0] === '$' || lines[i].substring(0, 4) === '    ') {
      // literal line
      buf += lines[i] + '\n';
      continue;
    }

    for (let j = 0; j < words.length; j++) {
      if (words[j].length === 0) {
        // explicit line break
        linebuf += '\n';
        break;
      }

      if (linebuf.split('\n').slice(-1)[0].length + 1 + words[j].length > limit) {
        linebuf += '\n';
        linebuf += pad;
      }
      linebuf += words[j] + ' ';
    }

    buf += linebuf + '\n';
  }
  return buf;
}

/*
 * Format command usage lines.
 * Generate two strings:
 * raw string:
 *    COMMAND ARG_NAME ARG_NAME ARG_NAME [OPTINONAL ARG NAME]
 * keyword string:
 *    COMMAND --arg_name TYPE
 *            --arg_name TYPE
 *            [--arg_name TYPE]
 */
interface CLI_COMMAND_HELP {
  raw: string;
  kw: string;
}

function formatCommandHelpLines(
  commandName: string,
  commandArgs: CLI_PROP_ITEM[]
): CLI_COMMAND_HELP {
  let rawUsage = '';
  let kwUsage = '';
  let kwPad = '';
  const commandInfo = CLI_ARGS.properties[commandName];

  rawUsage = `  ${commandName} `;
  for (let i = 0; i < commandArgs.length; i++) {
    if (!commandArgs[i].name) {
      console.log(commandName);
      console.log(commandArgs[i]);
      throw new Error('BUG: command info is missing a "name" field');
    }
    if (i + 1 <= commandInfo.minItems) {
      rawUsage += `${commandArgs[i].name.toUpperCase()} `;
    } else {
      rawUsage += `[${commandArgs[i].name.toUpperCase()}] `;
    }
  }

  kwUsage = `  ${commandName} `;
  for (let i = 0; i < commandName.length + 3; i++) {
    kwPad += ' ';
  }

  for (let i = 0; i < commandArgs.length; i++) {
    if (!commandArgs[i].realtype) {
      console.log(commandName);
      console.log(commandArgs[i]);
      throw new Error('BUG: command info is missing a "realtype" field');
    }
    if (i + 1 <= commandInfo.minItems) {
      kwUsage += `--${commandArgs[i].name} ${commandArgs[i].realtype.toUpperCase()}`;
    } else {
      kwUsage += `[--${commandArgs[i].name} ${commandArgs[i].realtype.toUpperCase()}]`;
    }
    kwUsage += '\n';
    kwUsage += kwPad;
  }

  return { raw: rawUsage, kw: kwUsage } as CLI_COMMAND_HELP;
}

/*
 * Get the set of commands grouped by command group
 */
interface CLI_COMMAND_GROUP_ITEM {
  command: string;
  help: string;
}

interface CLI_COMMAND_GROUP {
  [index: string]: CLI_COMMAND_GROUP_ITEM[];
}

function getCommandGroups(): CLI_COMMAND_GROUP {
  const groups: CLI_COMMAND_GROUP = {};
  const commands = Object.keys(CLI_ARGS.properties);
  for (let i = 0; i < commands.length; i++) {
    const command = commands[i];
    const group = CLI_ARGS.properties[command].group;

    if (!groups.hasOwnProperty(group)) {
      groups[group] = [
        {
          command: command,
          help: CLI_ARGS.properties[command].help,
        } as CLI_COMMAND_GROUP_ITEM,
      ];
    } else {
      groups[group].push({
        command: command,
        help: CLI_ARGS.properties[command].help,
      } as CLI_COMMAND_GROUP_ITEM);
    }
  }
  return groups;
}

/*
 * Make all commands list
 */
export function makeAllCommandsList(): string {
  const groups = getCommandGroups();
  const groupNames = Object.keys(groups).sort();

  let res = `All commands (run '${process.argv[1]} help COMMAND' for details):\n`;
  for (let i = 0; i < groupNames.length; i++) {
    res += `  ${groupNames[i]}: `;
    const cmds = [];
    for (let j = 0; j < groups[groupNames[i]].length; j++) {
      cmds.push(groups[groupNames[i]][j].command);
    }

    // wrap at 80 characters
    const helpLineSpaces = formatHelpString(4, 70, cmds.join(' '));
    const helpLineCSV =
      '    ' +
      helpLineSpaces
        .split('\n    ')
        .map(line => line.trim().replace(/ /g, ', '))
        .join('\n    ') +
      '\n';

    res += '\n' + helpLineCSV;
    res += '\n';
  }
  return res.trim();
}

/*
 * Make help for all commands
 */
export function makeAllCommandsHelp(): string {
  const groups = getCommandGroups();
  const groupNames = Object.keys(groups).sort();

  const helps = [];
  let cmds = [];
  for (let i = 0; i < groupNames.length; i++) {
    for (let j = 0; j < groups[groupNames[i]].length; j++) {
      cmds.push(groups[groupNames[i]][j].command);
    }
  }

  cmds = cmds.sort();
  for (let i = 0; i < cmds.length; i++) {
    helps.push(makeCommandUsageString(cmds[i]).trim());
  }

  return helps.join('\n\n');
}

/*
 * Make a usage string for a single command
 */
export function makeCommandUsageString(command?: string): string {
  let res = '';
  if (command === 'all') {
    return makeAllCommandsHelp();
  }
  if (!command) {
    return makeAllCommandsList();
  }

  const commandInfo = CLI_ARGS.properties[command];
  if (!commandInfo || command === 'help') {
    return makeAllCommandsList();
  }

  const help = commandInfo.help;

  const cmdFormat = formatCommandHelpLines(command, commandInfo.items);
  const formattedHelp = formatHelpString(2, 78, help);

  // make help string for one command
  res += `Command: ${command}\n`;
  res += 'Usage:\n';
  res += `${cmdFormat.raw}\n`;
  res += `${cmdFormat.kw}\n`;
  res += formattedHelp;
  return res.trim() + '\n';
}

/*
 * Make the usage documentation
 */
export function makeUsageString(): string {
  let res = `${USAGE}\n\nCommand reference\n`;
  const groups = getCommandGroups();
  const groupNames = Object.keys(groups).sort();

  for (let i = 0; i < groupNames.length; i++) {
    const groupName = groupNames[i];
    const groupCommands = groups[groupName];

    res += `Command group: ${groupName}\n\n`;
    for (let j = 0; j < groupCommands.length; j++) {
      const command = groupCommands[j].command;
      const help = groupCommands[j].help;

      const commandInfo = CLI_ARGS.properties[command];

      const cmdFormat = formatCommandHelpLines(command, commandInfo.items);
      const formattedHelp = formatHelpString(4, 76, help);

      res += cmdFormat.raw;
      res += '\n';
      res += cmdFormat.kw;
      res += '\n';
      res += formattedHelp;
      res += '\n';
    }
    res += '\n';
  }

  return res;
}

/*
 * Print usage
 */
export function printUsage() {
  console.error(makeUsageString());
}

/*
 * Implement just enough getopt(3) to be useful.
 * Only handles short options.
 * Returns an object whose keys are option flags that map to true/false,
 * or to a value.
 * The key _ is mapped to the non-opts list.
 */
interface CLI_OPTS {
  [index: string]: null | boolean | string | string[];
}

export function getCLIOpts(
  argv: string[],
  opts: string = 'deitlUxC:F:B:P:D:G:N:H:T:I:m:M:X:u:p:c:'
): CLI_OPTS {
  const optsTable: CLI_OPTS = {};
  const remainingArgv = [];
  const argvBuff = argv.slice(0);

  for (let i = 0; i < opts.length; i++) {
    if (opts[i] == ':') {
      continue;
    }
    if (i + 1 < opts.length && opts[i + 1] == ':') {
      optsTable[opts[i]] = null;
    } else {
      optsTable[opts[i]] = false;
    }
  }

  for (const opt of Object.keys(optsTable)) {
    for (let i = 0; i < argvBuff.length; i++) {
      if (argvBuff[i] === null) {
        break;
      }
      if (argvBuff[i] === '--') {
        break;
      }

      const argvOpt = `-${opt}`;
      if (argvOpt === argvBuff[i]) {
        if (optsTable[opt] === false) {
          // boolean switch
          optsTable[opt] = true;
          argvBuff[i] = '';
        } else {
          // argument
          optsTable[opt] = argvBuff[i + 1];
          argvBuff[i] = '';
          argvBuff[i + 1] = '';
        }
      }
    }
  }

  for (let i = 0; i < argvBuff.length; i++) {
    if (argvBuff[i].length > 0) {
      if (argvBuff[i] === '--') {
        continue;
      }
      remainingArgv.push(argvBuff[i]);
    }
  }

  optsTable['_'] = remainingArgv;
  return optsTable;
}

export function CLIOptAsString(opts: CLI_OPTS, key: string): string | null {
  if (opts[key] === null || opts[key] === undefined) {
    return null;
  } else if (typeof opts[key] === 'string') {
    return `${opts[key]}`;
  } else {
    throw new Error(`Option '${key}' is not a string`);
  }
}

export function CLIOptAsBool(opts: CLI_OPTS, key: string): boolean {
  if (typeof opts[key] === 'boolean' || opts[key] === null) {
    return !!opts[key];
  } else {
    throw new Error(`Option '${key}' is not a boolean`);
  }
}

function isStringArray(value: any): value is string[] {
  if (value instanceof Array) {
    return value
      .map((s: any) => typeof s === 'string')
      .reduce((x: boolean, y: boolean) => x && y, true);
  } else {
    return false;
  }
}

export function CLIOptAsStringArray(opts: CLI_OPTS, key: string): string[] | null {
  const value: any = opts[key];
  if (value === null || value === undefined) {
    return null;
  } else if (isStringArray(value)) {
    return value;
  } else {
    throw new Error(`Option '${key}' is not a string array`);
  }
}

/*
 * Use the CLI schema to get all positional and keyword args
 * for a given command.
 */
export function getCommandArgs(command: string, argsList: string[]) {
  let commandProps = CLI_ARGS.properties[command].items;
  if (!Array.isArray(commandProps)) {
    commandProps = [commandProps];
  }

  const orderedArgs = [];
  const foundArgs: Record<string, string> = {};

  // scan for keywords
  for (let i = 0; i < argsList.length; i++) {
    if (argsList[i].startsWith('--')) {
      // keyword argument
      const argName = argsList[i].slice(2);
      let argValue = null;

      // dup?
      if (foundArgs.hasOwnProperty(argName)) {
        return {
          status: false,
          error: `duplicate argument ${argsList[i]}`,
        };
      }

      for (let j = 0; j < commandProps.length; j++) {
        if (!commandProps[j].hasOwnProperty('name')) {
          continue;
        }
        if (commandProps[j].name === argName) {
          // found!
          // end of args?
          if (i + 1 >= argsList.length) {
            return {
              status: false,
              error: `no value for argument ${argsList[i]}`,
            };
          }

          argValue = argsList[i + 1];
        }
      }

      if (argValue) {
        // found an argument given as a keyword
        i += 1;
        foundArgs[argName] = argValue;
      } else {
        return {
          status: false,
          error: `no such argument ${argsList[i]}`,
        };
      }
    } else {
      // positional argument
      orderedArgs.push(argsList[i]);
    }
  }

  // merge foundArgs and orderedArgs back into an ordered argument list
  // that is conformant to the CLI specification.
  const mergedArgs = [];
  let orderedArgIndex = 0;

  for (let i = 0; i < commandProps.length; i++) {
    if (orderedArgIndex < orderedArgs.length) {
      if (!commandProps[i].hasOwnProperty('name')) {
        // unnamed positional argument
        mergedArgs.push(orderedArgs[orderedArgIndex]);
        orderedArgIndex += 1;
      } else if (!foundArgs.hasOwnProperty(commandProps[i].name)) {
        // named positional argument, NOT given as a keyword
        mergedArgs.push(orderedArgs[orderedArgIndex]);
        orderedArgIndex += 1;
      } else {
        // keyword argument
        mergedArgs.push(foundArgs[commandProps[i].name]);
      }
    } else {
      // keyword argument (possibly undefined)
      mergedArgs.push(foundArgs[commandProps[i].name]);
    }
  }

  return {
    status: true,
    arguments: mergedArgs,
  };
}

/*
 * Check command args
 */
export interface CheckArgsSuccessType {
  success: true;
  command: string;
  args: string[];
}

export interface CheckArgsFailType {
  success: false;
  error: string;
  command: string;
  usage: boolean;
}

export function checkArgs(argList: string[]): CheckArgsSuccessType | CheckArgsFailType {
  if (argList.length <= 2) {
    return {
      success: false,
      error: 'No command given',
      usage: true,
      command: '',
    };
  }

  const commandName = argList[2];
  const allCommandArgs = argList.slice(3);

  if (!CLI_ARGS.properties.hasOwnProperty(commandName)) {
    return {
      success: false,
      error: `Unrecognized command '${commandName}'`,
      usage: true,
      command: commandName,
    };
  }

  const parsedCommandArgs = getCommandArgs(commandName, allCommandArgs);
  if (!parsedCommandArgs.status) {
    return {
      success: false,
      error: parsedCommandArgs.error!,
      usage: true,
      command: commandName,
    };
  }

  const commandArgs = parsedCommandArgs.arguments;

  // validate all required commands as given.
  // if there are optional commands, then only validate
  // them if they're given.
  const commandSchema = JSON.parse(JSON.stringify(CLI_ARGS.properties[commandName]));
  for (let i = commandSchema.minItems; i < commandSchema.maxItems; i++) {
    if (i < commandArgs!.length) {
      if (commandArgs![i] === null || commandArgs![i] === undefined) {
        // optional argument not given.  Update the schema we're checking against
        // to expect this.
        // @ts-ignore
        commandArgs[i] = null;
        commandSchema.items[i] = { type: 'null' };
      }
    }
  }

  const ajv = Ajv();
  const valid = ajv.validate(commandSchema, commandArgs);
  if (!valid) {
    let errorMsg = '';
    for (let i = 0; i < ajv.errors!.length; i++) {
      const msg = `Invalid command arguments: Schema "${
        ajv.errors![0].schemaPath
      }" failed validation (problem: "${ajv.errors![0].message}", cause: "${JSON.stringify(
        ajv.errors![0].params
      )}")\n`;
      errorMsg += msg;
    }
    return {
      success: false,
      error: errorMsg,
      usage: true,
      command: commandName,
    };
  }

  return {
    success: true,
    command: commandName,
    args: commandArgs!,
  };
}

/**
 * Load the config file and return a config dict.
 * If no config file exists, then return the default config.
 *
 * @configPath (string) the path to the config file.
 * @networkType (sring) 'mainnet', 'regtest', 'localnet', or 'testnet'
 */
export function loadConfig(configFile: string, networkType: string): CLI_CONFIG_TYPE {
  if (
    networkType !== 'mainnet' &&
    networkType !== 'testnet' &&
    networkType != 'regtest' &&
    networkType != 'localnet'
  ) {
    throw new Error('Unregognized network');
  }

  let configRet: CLI_CONFIG_TYPE;

  if (networkType === 'mainnet') {
    configRet = Object.assign({}, CONFIG_DEFAULTS);
  } else if (networkType === 'regtest') {
    configRet = Object.assign({}, CONFIG_REGTEST_DEFAULTS);
  } else if (networkType === 'localnet') {
    configRet = Object.assign({}, CONFIG_LOCALNET_DEFAULTS);
  } else {
    configRet = Object.assign({}, CONFIG_TESTNET_DEFAULTS);
  }

  try {
    configRet = JSON.parse(fs.readFileSync(configFile).toString()) as CLI_CONFIG_TYPE;
  } catch (e) {}

  return configRet;
}
