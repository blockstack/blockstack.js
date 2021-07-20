# Universal Resolver Driver: did:stack:v2 DIDs

This is a Universal Resolver driver for did:stack:v2 identifiers.

## Specifications

- [Decentralized Identifiers](https://www.w3.org/TR/did-core/)
- [DID Method Specification]('../docs/DID_Method_Spec.md')

## Example DIDs

```
did:stack:v2:SP1CPT00K0E3FNCQTTCYBAQRB5QYXHQCCWZTAHY33-0x965c0627aad3a04f59254c6f9a0f880444dd40fe0e22337e84f6cd0446635fa5
```

## Build and Run (Docker)

```
docker build -f ./uni-resolver-driver/Dockerfile . -t universalresolver/driver-did-stack-v2
docker run -p 8080:8080 universalresolver/driver-did-stack-v2
curl -X GET did:stack:v2:SP1CPT00K0E3FNCQTTCYBAQRB5QYXHQCCWZTAHY33-0x965c0627aad3a04f59254c6f9a0f880444dd40fe0e22337e84f6cd0446635fa5
```

A simple npm script for building and spinning up the Docker image is also provided, and can be run as follows:

```
npm run uni-resolver-driver
```

## Driver Environment Variables

The driver recognizes the following environment variables:

(none)

## Driver Metadata

The driver returns the following metadata in addition to a DID document:

(none)
