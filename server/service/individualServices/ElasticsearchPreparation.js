const { elasticsearchService, getIndexAliasAsync, operationalStateEnum } = require('onf-core-model-ap/applicationPattern/services/ElasticsearchService');

/**
 * @description Elasticsearch preparation. Checks if ES instance is configured properly.
 * As first step, tries pinging the ES instance. If this doesn't work, ES
 * is considered not reachable or configured with wrong connection parameters.
 *
 * EATL application will still run and allow the operator to properly configure
 * ES connection parameters through REST API.
 *
 * If the ES instance is reachable, as next steps it will try to find existing or
 * configure index-pattern and index-alias, based on index-alias in CONFIG file.
 *
 * @returns {Promise<void>}
 */
module.exports = async function prepareElasticsearch() {
    console.log("Configuring Elasticsearch...");
    let ping = await elasticsearchService.getElasticsearchClientOperationalStateAsync();
    if (ping === operationalStateEnum.UNAVAILABLE) {
        console.error(`Elasticsearch unavailable. Skipping Elasticsearch configuration.`);
        return;
    }
    let body = {
        "elasticsearch-client-interface-1-0:service-records-policy" : {
        "service-records-policy-name": "eatl_service_records_policy",
        "phases": {
          "hot": {
            "min-age": "30s",
            "actions": {
              "rollover": {
                "max-age": "5d"
              }
            }
          },
          "delete": {
            "min-age": "5d",
            "actions": {
              "delete": {
                "delete-searchable-snapshot": true
              }
            }
          }
        }}
    };
    await elasticsearchService.putElasticsearchClientServiceRecordsPolicyAsync(undefined, body);
    await createIndexTemplate();
    await elasticsearchService.createAlias();
    console.log('Elasticsearch is properly configured!');
}

/**
 * @description Creates/updates index-template with EATL proprietary mapping.
 *
 * Proprietary mapping is needed for the field 'x-correlator' which is only
 * searchable if it's field is 'keyword'. By default ES denotes string fields
 * as 'text'.
 *
 * This template serves as binding between service policy and index.
 * If index-alias is changed, this index-template will be rewritten to reflect
 * the change, as we do not wish to continue applying service policy on an
 * index-alias that does not exist.
 *
 * Service policy is not set at this point in the index-template.
 * @returns {Promise<void>}
 */
async function createIndexTemplate() {
    let indexAlias = await getIndexAliasAsync();
    let client = await elasticsearchService.getClient(false);
    // disable creation of index, if it's not yet created by the app
    await client.cluster.putSettings({
        body: {
            persistent: {
                "action.auto_create_index": "false"
            }
        }
    });
    let found = await elasticsearchService.getExistingIndexTemplate();
    let iTemplate = found ? found : {
        name: 'eatl-index-template',
        body: {
            index_patterns: `${indexAlias}-*`,
            template: {
                settings: {
                    'index.lifecycle.name': "eatl_service_records_policy",
                    'index.lifecycle.rollover_alias': indexAlias
                }
            }
        }
    }
    await client.cluster.putComponentTemplate({
        name: 'eatl-mappings',
        body: {
            template: {
                mappings: {
                    properties: {
                        'x-correlator': { type: 'keyword' },
                        'trace-indicator': { type: 'text' },
                        'user': { type: 'text' },
                        'originator': { type: 'text' },
                        'application-name': { type: 'text' },
                        'release-number': { type: 'text' },
                        'operation-name': { type: 'text' },
                        'response-code': { type: 'integer' },
                        'timestamp': { type: 'date' },
                        'stringified-body': { type: 'text' },
                        'stringified-response': { type: 'text' },
                        'url': { type: 'text'},
                        'exec-time': { type: 'integer' }
                    }
                }
            }
        }
    });
    iTemplate.body.composed_of = ['eatl-mappings'];
    await client.indices.putIndexTemplate(iTemplate);
}
