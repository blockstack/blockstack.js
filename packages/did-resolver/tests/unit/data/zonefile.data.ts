/**
 * Mapping a DID to a set of keys requires mapping it to a BNS name first.
 * This process requires some zone file parsing / handling, mostly related
 * to parsing included URI / TXT resource records.
 *
 * The zone file exported from this file is an abridged version (removed most TXT resource records) of the zone file for the
 * id.blockstack name
 *
 */

export const testZoneFile = `$ORIGIN id.blockstack
$TTL 3600
jackjoe666	IN	TXT	"owner=163qawfFm3qKQfmssNEjwEij17ghcRCeyJ" "seqn=0" "parts=1" "zf0=JE9SSUdJTiBqYWNram9lNjY2LmlkLmJsb2Nrc3RhY2sKJFRUTCAzNjAwCl9odHRwLl90Y3AJSU4JVVJJCTEwCTEJImh0dHBzOi8vZ2FpYS5ibG9ja3N0YWNrLm9yZy9odWIvMTYzcWF3ZkZtM3FLUWZtc3NORWp3RWlqMTdnaGNSQ2V5Si9wcm9maWxlLmpzb24iCgo="
htdhtfkihtdkhtd	IN	TXT	"owner=1ECLpyrNKKirXkh2xrWBrM4DN4YYbk68c9" "seqn=0" "parts=1" "zf0=JE9SSUdJTiBodGRodGZraWh0ZGtodGQuaWQuYmxvY2tzdGFjawokVFRMIDM2MDAKX2h0dHAuX3RjcAlJTglVUkkJMTAJMQkiaHR0cHM6Ly9nYWlhLmJsb2Nrc3RhY2sub3JnL2h1Yi8xRUNMcHlyTktLaXJYa2gyeHJXQnJNNERONFlZYms2OGM5L3Byb2ZpbGUuanNvbiIKCg=="
erzuah44	IN	TXT	"owner=1HWFYaQfBfanMoazkY9aejviRMDjHujtJa" "seqn=0" "parts=1" "zf0=JE9SSUdJTiBlcnp1YWg0NC5pZC5ibG9ja3N0YWNrCiRUVEwgMzYwMApfaHR0cC5fdGNwCUlOCVVSSQkxMAkxCSJodHRwczovL2dhaWEuYmxvY2tzdGFjay5vcmcvaHViLzFIV0ZZYVFmQmZhbk1vYXprWTlhZWp2aVJNRGpIdWp0SmEvcHJvZmlsZS5qc29uIgoK"
lolotronix	IN	TXT	"owner=1BRnzF2WZTLvhnwP2NyaviouMiFhBpormu" "seqn=0" "parts=1" "zf0=JE9SSUdJTiBsb2xvdHJvbml4LmlkLmJsb2Nrc3RhY2sKJFRUTCAzNjAwCl9odHRwLl90Y3AJSU4JVVJJCTEwCTEJImh0dHBzOi8vZ2FpYS5ibG9ja3N0YWNrLm9yZy9odWIvMUJSbnpGMldaVEx2aG53UDJOeWF2aW91TWlGaEJwb3JtdS9wcm9maWxlLmpzb24iCgo="
janszeneri	IN	TXT	"owner=1G639ByTm2UqkhC5M3wfZ1FEFNErhPFeXM" "seqn=0" "parts=1" "zf0=JE9SSUdJTiBqYW5zemVuZXJpLmlkLmJsb2Nrc3RhY2sKJFRUTCAzNjAwCl9odHRwLl90Y3AJSU4JVVJJCTEwCTEJImh0dHBzOi8vZ2FpYS5ibG9ja3N0YWNrLm9yZy9odWIvMUc2MzlCeVRtMlVxa2hDNU0zd2ZaMUZFRk5FcmhQRmVYTS9wcm9maWxlLmpzb24iCgo="
_http._tcp	IN	URI	10	1	"https://gaia.blockstack.org/hub/1MAUWkS4rgHpsmr5sLCKBDA4o5ZRcxUFUb/profile.json"
_resolver	IN	URI	10	1	"https://registrar.blockstack.org`
