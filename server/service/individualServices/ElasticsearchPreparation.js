const { elasticsearchService, getIndexAliasAsync, operationalStateEnum } = require('onf-core-model-ap/applicationPattern/services/ElasticsearchService');

/**
 * @description What needs to be configured on Elasticsearch to properly integrated with EATL
 * 1. Service policy. The name is relevant only for step 2. 
 * @example PUT _ilm/policy/eatl_service_records_policy
 * {
 *   "policy": {
 *     "phases": {
 *       "hot": {
 *         "actions": {
 *           "rollover" : {
 *             "max_age": "2m"
 *           }
 *         }
 *       },
 *       "delete": {
 *         "min_age": "2m",
 *         "actions": {
 *           "delete": {}
 *         }
 *       }
 *     }
 *   }
 * }
 * 2. Index template. Index_pattern MUST be '<index_alias>-*' in order to match all
 * the indexes under configured index alias. Rollover_alias MUST match configured 
 * index alias. You can use REST API to find configured index alias.
 * 
 * lifecycle.name MUST match service policy name from step 1.
 *
 * @example PUT _index_template/eatl_service_records
 * {
 *   "index_patterns": "eatl-2-0-0-*",
 *   "template": {
 *     "settings": {
 *       "index.lifecycle.name": "eatl_service_records_policy",
 *       "index.lifecycle.rollover_alias": "eatl-2-0-0"
 *     }
 *   }
 * }
 */
module.exports = async function prepareElasticsearch() {
    console.log("Configuring Elasticsearch...");
    let indexAlias = await getIndexAliasAsync();
    let client = await elasticsearchService.getClient(true);
    let ping = await elasticsearchService.getElasticsearchClientOperationalStateAsync();
    if (ping === operationalStateEnum.UNAVAILABLE) {
        console.error(`Elasticsearch unavailable. Skipping Elasticsearch configuration.`);
        return;
    }
    let response = await client.cat.templates({
        format: 'json',
        h: 'name,index_patterns'
    });
    let found = response.body.find(item => {
        return item['index_patterns'].includes(indexAlias)
    });
    if (!found) {
        console.error(`Cannot start EATL without configured index template. Could not find a template with index pattern matching ${indexAlias}.`);
        return;
    }
    let templateName = found['name'];

    let iTemplateResponse = await client.indices.getIndexTemplate({
        name: templateName
    });
    let iTemplate = iTemplateResponse.body.index_templates[0].index_template;

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
                        'stringified-response': { type: 'text' }
                    }
                }
            }
        }
    });
    iTemplate.composed_of = ['eatl-mappings'];
    await client.indices.putIndexTemplate({
        name: templateName,
        body: iTemplate
    });

    let alias = await client.indices.existsAlias({
        name: indexAlias
    });
    if (!alias.body) {
        await client.indices.create({
            index: `${indexAlias}-0001`,
            body: {
                aliases: {
                    [indexAlias]: {
                        is_write_index: true
                    }
                }
            }
        });
    }
    console.log('Elasticsearch is properly configured!');
}