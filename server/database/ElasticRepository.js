//@ts-check
'use strict'

const { Client } = require('@elastic/elasticsearch');

const index_alias = 'eatl_service_records';
const service_records_policy = 'eatl_service_records_policy';
// @ts-ignore
const client = new Client(_resolveEsConfig());

function _resolveEsConfig() {
  return {
    node: process.env.ES_NODE,
    auth: {
      username: process.env.ES_USER,
      password: process.env.ES_PASSWORD
    },
    tls: {
      // required if elasticsearch has a self-signed certificate
      rejectUnauthorized: false
    }
  }
}

async function _prepareServiceRecordIndex() {
  const exists = await client.indices.existsAlias({ name: index_alias });
  if (exists.statusCode !== 404) {
    return;
  }

  await client.ilm.putLifecycle({
    "policy": service_records_policy,
    "body": {
      "policy": {
        "phases": {
          "hot": {
            "min_age": "0ms",
            "actions": {
              "rollover": {
                "max_age": "5d"
              }
            }
          },
          "delete": {
            "min_age": "5d",
            "actions": {
              "delete": {}
            }
          }
        }
      }
    }
  });
  console.log(`Index lifecycle policy "${service_records_policy}" is created.`);

  await client.indices.putIndexTemplate({
    "name": index_alias,
    "body": {
      "index_patterns": index_alias + "-*",
      "template": {
        "settings": {
          "index.lifecycle.name": service_records_policy,
          "index.lifecycle.rollover_alias": index_alias
        },
        mappings: {
          properties: {
            'x-correlator': { type: 'keyword' },
            'trace-indicator': { type: 'text' },
            'user': { type: 'text' },
            'originator': { type: 'text' },
            'application-name': { type: 'text' },
            'application-release-number': { type: 'text' },
            'operation-name': { type: 'text' },
            'response-code': { type: 'integer' },
            'timestamp': { type: 'date' },
            'stringified-body': { type: 'text' },
            'stringified-response': { type: 'text' }
          }
        }
      }
    }
  });
  console.log(`Index template "${index_alias}" is created.`);

  await client.indices.create({
    index: index_alias + "-000001",
    body: {
      settings: {
        lifecycle: {
          name: service_records_policy,
          rollover_alias: index_alias
        }
      },
      aliases: {
        [index_alias]: {
          is_write_index: true
        }
      }
    }
  })
  console.log(`Index alias "${index_alias}" is created.`);
}

exports.readServiceRecordsOfFlow = async function readServiceRecordsOfFlow(xCorrelator) {
  _prepareServiceRecordIndex();
  const result = await client.search({
    index: index_alias,
    size: 1000,
    body: {
      query: {
        term: {
          'x-correlator': xCorrelator
        }
      }
    }
  })
  return _createResultArray(result);
}


exports.recordServiceRequest = async function recordServiceRequest(record) {
  _prepareServiceRecordIndex();
  return await client.index({
    index: index_alias,
    body: record
  });
}

exports.readAllServiceRecords = async function readAllServiceRecords() {
  _prepareServiceRecordIndex();
  const result = await client.search({
    index: index_alias,
    size: 1000,
    body: {
      query: {
        match_all: {}
      }
    }
  })
  return _createResultArray(result);
}

exports.readUnsuccessfullServiceRecords = async function readUnsuccessfullServiceRecords() {
  _prepareServiceRecordIndex();
  const result = await client.search({
    index: index_alias,
    size: 1000,
    body: {
      query: {
        bool: {
          must_not: {
            range: {
              'response-code': {
                gte: 200,
                lt: 300
              }
            }
          }
        }
      }
    }
  })
  return _createResultArray(result);
}

function _createResultArray(result) {
  const resultArray = [];
  result.body.hits.hits.forEach((item) => {
    resultArray.push(item._source);
  });
  return resultArray;
}