'use strict';

const LogicalTerminationPointConfigurationInput = require('onf-core-model-ap/applicationPattern/onfModel/services/models/logicalTerminationPoint/ConfigurationInput');
const LogicalTerminationPointService = require('onf-core-model-ap/applicationPattern/onfModel/services/LogicalTerminationPointServices');
const LogicalTerminationPointServiceOfUtility = require("onf-core-model-ap-bs/basicServices/utility/LogicalTerminationPoint")
const ForwardingConfigurationService = require('onf-core-model-ap/applicationPattern/onfModel/services/ForwardingConstructConfigurationServices');
const ForwardingAutomationService = require('onf-core-model-ap/applicationPattern/onfModel/services/ForwardingConstructAutomationServices');
const prepareForwardingConfiguration = require('./individualServices/PrepareForwardingConfiguration');
const prepareALTForwardingAutomation = require('onf-core-model-ap-bs/basicServices/services/PrepareALTForwardingAutomation');

const httpClientInterface = require('onf-core-model-ap/applicationPattern/onfModel/models/layerProtocols/HttpClientInterface');

const onfAttributeFormatter = require('onf-core-model-ap/applicationPattern/onfModel/utility/OnfAttributeFormatter');

const onfAttributes = require('onf-core-model-ap/applicationPattern/onfModel/constants/OnfAttributes');

const ConfigurationStatus = require('onf-core-model-ap/applicationPattern/onfModel/services/models/ConfigurationStatus');
const LogicalTerminationPointConfigurationStatus = require('onf-core-model-ap/applicationPattern/onfModel/services/models/logicalTerminationPoint/ConfigurationStatus');
const tcpClientInterface = require('onf-core-model-ap/applicationPattern/onfModel/models/layerProtocols/TcpClientInterface');

const softwareUpgrade = require('./individualServices/SoftwareUpgrade');
const { getIndexAliasAsync, createResultArray, elasticsearchService } = require('onf-core-model-ap/applicationPattern/services/ElasticsearchService');
const individualServicesOperationsMapping = require('./individualServices/IndividualServicesOperationsMapping');
const TcpObject = require('onf-core-model-ap/applicationPattern/onfModel/services/models/TcpObject');
const RegardApplication = require('./individualServices/RegardApplication');
const REDIRECT_SERVICE_REQUEST_OPERATION = '/v1/redirect-service-request-information';
const NEW_RELEASE_FORWARDING_NAME = 'PromptForBequeathingDataCausesTransferOfListOfApplications';
const AsyncLock = require('async-lock');
const lock = new AsyncLock();

/**
 * Initiates process of embedding a new release
 *
 * body V1_bequeathyourdataanddie_body 
 * user String User identifier from the system starting the service call
 * originator String 'Identification for the system consuming the API, as defined in  [/core-model-1-4:control-construct/logical-termination-point={uuid}/layer-protocol=0/http-client-interface-1-0:http-client-interface-pac/http-client-interface-capability/application-name]' 
 * xCorrelator String UUID for the service execution flow that allows to correlate requests and responses
 * traceIndicator String Sequence of request numbers along the flow
 * customerJourney String Holds information supporting customer’s journey to which the execution applies
 * no response value expected for this operation
 **/
exports.bequeathYourDataAndDie = function (body, user, originator, xCorrelator, traceIndicator, customerJourney, operationServerName) {
  return new Promise(async function (resolve, reject) {
    try {
      let newApplicationName = body["new-application-name"];
      let newReleaseNumber = body["new-application-release"];
      let newAddress = body["new-application-address"];
      let newPort = body["new-application-port"];
      let newProtocol = body['new-application-protocol'];

      let newReleaseHttpClientLtpUuid = await LogicalTerminationPointServiceOfUtility.resolveHttpTcpAndOperationClientUuidOfNewRelease();
      let newReleaseHttpUuid = newReleaseHttpClientLtpUuid.httpClientUuid;
      let newReleaseTcpUuid = newReleaseHttpClientLtpUuid.tcpClientUuid;

      /**
       * Current values in NewRelease client.
       */
      let currentApplicationName = await httpClientInterface.getApplicationNameAsync(newReleaseHttpUuid);
      let currentReleaseNumber = await httpClientInterface.getReleaseNumberAsync(newReleaseHttpUuid);
      let currentRemoteAddress = await tcpClientInterface.getRemoteAddressAsync(newReleaseTcpUuid);
      let currentRemoteProtocol = await tcpClientInterface.getRemoteProtocolAsync(newReleaseTcpUuid);
      let currentRemotePort = await tcpClientInterface.getRemotePortAsync(newReleaseTcpUuid);

      /**
       * Update only data that needs to be updated, comparing incoming values with values set in
       * NewRelease client.
       */
      let isUpdated = {};
      let isDataTransferRequired = true;
      if (newApplicationName !== currentApplicationName) {
        isUpdated.applicationName = await httpClientInterface.setApplicationNameAsync(newReleaseHttpUuid, newApplicationName)
      }
      if (newReleaseNumber !== currentReleaseNumber) {
        isUpdated.releaseNumber = await httpClientInterface.setReleaseNumberAsync(newReleaseHttpUuid, newReleaseNumber);
      }
      if (isAddressChanged(currentRemoteAddress, newAddress)) {
        isUpdated.address = await tcpClientInterface.setRemoteAddressAsync(newReleaseTcpUuid, newAddress);
      }
      if (newPort !== currentRemotePort) {
        isUpdated.port = await tcpClientInterface.setRemotePortAsync(newReleaseTcpUuid, newPort);
      }
      if (newProtocol !== currentRemoteProtocol) {
        isUpdated.protocol = await tcpClientInterface.setRemoteProtocolAsync(newReleaseTcpUuid, newProtocol);
      }


      /**
       * Updating the Configuration Status based on the application information updated
       */
      let tcpClientConfigurationStatus = new ConfigurationStatus(
        newReleaseTcpUuid,
        '',
        (isUpdated.address || isUpdated.port || isUpdated.protocol)
      );
      let httpClientConfigurationStatus = new ConfigurationStatus(
        newReleaseHttpUuid,
        '',
        (isUpdated.applicationName || isUpdated.releaseNumber)
      );

      let logicalTerminationPointConfigurationStatus = new LogicalTerminationPointConfigurationStatus(
        [],
        httpClientConfigurationStatus,
        [tcpClientConfigurationStatus]
      );

      /****************************************************************************************
       * Prepare attributes to automate forwarding-construct
       ****************************************************************************************/
      let forwardingAutomationInputList = await prepareALTForwardingAutomation.getALTForwardingAutomationInputAsync(
        logicalTerminationPointConfigurationStatus,
        undefined
      );
      ForwardingAutomationService.automateForwardingConstructAsync(
        operationServerName,
        forwardingAutomationInputList,
        user,
        xCorrelator,
        traceIndicator,
        customerJourney
      );

      softwareUpgrade.upgradeSoftwareVersion(isDataTransferRequired, newReleaseHttpUuid, user, xCorrelator, traceIndicator, customerJourney, forwardingAutomationInputList.length + 1)
        .catch(err => console.log(`upgradeSoftwareVersion failed with error: ${err}`));
      resolve();
    } catch (error) {
      reject(error);
    }
  });
}


/**
 * Removes application from list of targets of subscriptions for service requests
 *
 * body V1_disregardapplication_body 
 * user String User identifier from the system starting the service call
 * originator String 'Identification for the system consuming the API, as defined in  [/core-model-1-4:control-construct/logical-termination-point={uuid}/layer-protocol=0/http-client-interface-1-0:http-client-interface-pac/http-client-interface-capability/application-name]' 
 * xCorrelator String UUID for the service execution flow that allows to correlate requests and responses
 * traceIndicator String Sequence of request numbers along the flow
 * customerJourney String Holds information supporting customer’s journey to which the execution applies
 * no response value expected for this operation
 **/
exports.disregardApplication = async function (body, user, originator, xCorrelator, traceIndicator, customerJourney, operationServerName) {
  let applicationName = body["application-name"];
  let applicationReleaseNumber = body["release-number"];
  let httpClientUuid = await httpClientInterface.getHttpClientUuidExcludingOldReleaseAndNewRelease(
    applicationName,
    applicationReleaseNumber,
    NEW_RELEASE_FORWARDING_NAME
  );
  let ltpConfigurationStatus = await LogicalTerminationPointService.deleteApplicationLtpsAsync(
    httpClientUuid
  );

  let forwardingConfigurationInputList = [];
  let forwardingConstructConfigurationStatus;
  let operationClientConfigurationStatusList = ltpConfigurationStatus.operationClientConfigurationStatusList;

  if (operationClientConfigurationStatusList) {
    forwardingConfigurationInputList = await prepareForwardingConfiguration.disregardApplication(
      operationClientConfigurationStatusList
    );
    forwardingConstructConfigurationStatus = await ForwardingConfigurationService.
      unConfigureForwardingConstructAsync(
        operationServerName,
        forwardingConfigurationInputList
      );
  }

  let forwardingAutomationInputList = await prepareALTForwardingAutomation.getALTUnConfigureForwardingAutomationInputAsync(
    ltpConfigurationStatus
  );

  ForwardingAutomationService.automateForwardingConstructAsync(
    operationServerName,
    forwardingAutomationInputList,
    user,
    xCorrelator,
    traceIndicator,
    customerJourney
  );
}


/**
 * Provides list of applications that are requested to send service request notifications
 *
 * user String User identifier from the system starting the service call
 * originator String 'Identification for the system consuming the API, as defined in  [/core-model-1-4:control-construct/logical-termination-point={uuid}/layer-protocol=0/http-client-interface-1-0:http-client-interface-pac/http-client-interface-capability/application-name]' 
 * xCorrelator String UUID for the service execution flow that allows to correlate requests and responses
 * traceIndicator String Sequence of request numbers along the flow
 * customerJourney String Holds information supporting customer’s journey to which the execution applies
 * returns List
 **/
exports.listApplications = function () {
  return new Promise(async function (resolve, reject) {
    let forwardingName = "RegardApplicationCausesSequenceForInquiringServiceRecords.RequestForInquiringServiceRecords"
    try {
      /****************************************************************************************
       * Preparing response body
       ****************************************************************************************/
      let applicationList = await LogicalTerminationPointServiceOfUtility.getAllApplicationList(forwardingName);

      /****************************************************************************************
       * Setting 'application/json' response body
       ****************************************************************************************/
      let response = onfAttributeFormatter.modifyJsonObjectKeysToKebabCase(applicationList);
      resolve(response)
    } catch (error) {
      reject(error);
    }
  });
}

/**
 * Provides list of recorded service requests
 *
 * body V1_listrecords_body
 * returns List
 **/
exports.listRecords = async function (body) {
  let size = body["number-of-records"];
  let from = body["latest-record"];
  let query = {
    match_all: {}
  };
  if (size + from <= 10000) {
    let indexAlias = await getIndexAliasAsync();
    let client = await elasticsearchService.getClient(false);
    const result = await client.search({
      index: indexAlias,
      from: from,
      size: size,
      body: {
        query: query
      }
    });
    const resultArray = createResultArray(result);
    return { "response": resultArray, "took": result.body.took };
  }
  return await elasticsearchService.scroll(from, size, query);
}

/**
 * Provides list of service request records belonging to the same flow
 *
 * body V1_listrecordsofflow_body
 * returns List
 **/
exports.listRecordsOfFlow = async function (body) {
  let size = body["number-of-records"];
  let from = body["latest-match"];
  let desiredXCorrelator = body["x-correlator"];
  let query = {
    term: {
      "x-correlator": desiredXCorrelator
    }
  };
  if (size + from <= 10000) {
    let indexAlias = await getIndexAliasAsync();
    let client = await elasticsearchService.getClient(false);
    const result = await client.search({
      index: indexAlias,
      from: from,
      size: size,
      body: {
        query: query
      }
    });
    const resultArray = createResultArray(result);
    return { "response": resultArray, "took": result.body.took };
  }
  return await elasticsearchService.scroll(from, size, query);
}


/**
 * Provides list of unsuccessful service requests
 *
 * body V1_listrecordsofunsuccessful_body
 * returns List
 **/
exports.listRecordsOfUnsuccessful = async function (body) {
  let size = body["number-of-records"];
  let from = body["latest-unsuccessful"];
  let query = {
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
  };
  if (size + from <= 10000) {
    let indexAlias = await getIndexAliasAsync();
    let client = await elasticsearchService.getClient(false);
    const result = await client.search({
      index: indexAlias,
      from: from,
      size: size,
      body: {
        query: query
      }
    });
    const resultArray = createResultArray(result);
    return { "response": resultArray, "took": result.body.took };
  }
  return await elasticsearchService.scroll(from, size, query);
}

/**
 * Records a service request
 *
 * body ServiceRequestRecord 
 * no response value expected for this operation
 **/
exports.recordServiceRequest = async function (body) {
  let indexAlias = await getIndexAliasAsync();
  let client = await elasticsearchService.getClient(false);
  let startTime = process.hrtime();
  let result = await client.index({
    index: indexAlias,
    body: body
  });
  let backendTime = process.hrtime(startTime);
  if (result.body.result == 'created' || result.body.result == 'updated') {
    return { "took": backendTime[0] * 1000 + backendTime[1] / 1000000 };
  }
}


/**
 * Adds to the list of applications
 *
 * body V1_regardapplication_body 
 * user String User identifier from the system starting the service call
 * originator String 'Identification for the system consuming the API, as defined in  [/core-model-1-4:control-construct/logical-termination-point={uuid}/layer-protocol=0/http-client-interface-1-0:http-client-interface-pac/http-client-interface-capability/application-name]' 
 * xCorrelator String UUID for the service execution flow that allows to correlate requests and responses
 * traceIndicator String Sequence of request numbers along the flow
 * customerJourney String Holds information supporting customer’s journey to which the execution applies
 * no response value expected for this operation
 **/
exports.regardApplication = async function (body, user, originator, xCorrelator, traceIndicator, customerJourney, operationServerName) {
  return new Promise(async function (resolve, reject) {
    try {
      let applicationName = body['application-name'];
      let releaseNumber = body['release-number'];
      const tcpInfo = [new TcpObject(body['protocol'], body['address'], body['port'])];
      let operationNamesByAttributes = new Map();
      operationNamesByAttributes.set("redirect-service-request-operation", REDIRECT_SERVICE_REQUEST_OPERATION);

      await lock.acquire("Regard application", async () => {
        let httpClientUuid = await httpClientInterface.getHttpClientUuidExcludingOldReleaseAndNewRelease(
          applicationName,
          releaseNumber,
          NEW_RELEASE_FORWARDING_NAME
        );
        let ltpConfigurationInput = new LogicalTerminationPointConfigurationInput(
          httpClientUuid,
          applicationName,
          releaseNumber,
          tcpInfo,
          operationServerName,
          operationNamesByAttributes,
          individualServicesOperationsMapping.individualServicesOperationsMapping
        );
        let logicalTerminationPointconfigurationStatus = await LogicalTerminationPointService.createOrUpdateApplicationLtpsAsync(
          ltpConfigurationInput
        );

        let forwardingConfigurationInputList = [];
        let forwardingConstructConfigurationStatus;
        let operationClientConfigurationStatusList = logicalTerminationPointconfigurationStatus.operationClientConfigurationStatusList;

        if (operationClientConfigurationStatusList) {
          forwardingConfigurationInputList = await prepareForwardingConfiguration.regardApplication(
            operationClientConfigurationStatusList,
            REDIRECT_SERVICE_REQUEST_OPERATION
          );
          forwardingConstructConfigurationStatus = await ForwardingConfigurationService.
            configureForwardingConstructAsync(
              operationServerName,
              forwardingConfigurationInputList
            );
        }

        let applicationLayerTopologyForwardingInputList = await prepareALTForwardingAutomation.getALTForwardingAutomationInputAsync(
          logicalTerminationPointconfigurationStatus,
          forwardingConstructConfigurationStatus
        );

        await ForwardingAutomationService.automateForwardingConstructAsync(
          operationServerName,
          applicationLayerTopologyForwardingInputList,
          user,
          xCorrelator,
          traceIndicator,
          customerJourney
        );

        let result = await RegardApplication.regardApplication(
          applicationName,
          releaseNumber,
          user,
          xCorrelator,
          traceIndicator,
          customerJourney,
          applicationLayerTopologyForwardingInputList.length + 1
        );
      resolve(result);
      });
    } catch (error) {
      reject(error);
    }
  });
}

/****************************************************************************************
 * Functions utilized by individual services
 ****************************************************************************************/


function isAddressChanged(currentAddress, newAddress) {
  let currentIp = currentAddress[onfAttributes.TCP_CLIENT.IP_ADDRESS];
  let currentIpv4;
  if (currentIp) {
    currentIpv4 = currentIp[onfAttributes.TCP_CLIENT.IPV_4_ADDRESS];
  }
  let currentDomain = currentAddress[onfAttributes.TCP_CLIENT.DOMAIN_NAME];
  let newIp = newAddress[onfAttributes.TCP_CLIENT.IP_ADDRESS];
  let newIpv4;
  if (newIp) {
    newIpv4 = newIp[onfAttributes.TCP_CLIENT.IPV_4_ADDRESS];
  }
  let newDomain = newAddress[onfAttributes.TCP_CLIENT.DOMAIN_NAME];
  return (currentIpv4 !== newIpv4) || (currentDomain !== newDomain);
}


