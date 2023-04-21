'use strict';

const LogicalTerminationPointConfigurationInput = require('onf-core-model-ap/applicationPattern/onfModel/services/models/logicalTerminationPoint/ConfigurationInputWithMapping');
const LogicalTerminationPointService = require('onf-core-model-ap/applicationPattern/onfModel/services/LogicalTerminationPointWithMappingServices');

const ForwardingConfigurationService = require('onf-core-model-ap/applicationPattern/onfModel/services/ForwardingConstructConfigurationServices');
const ForwardingAutomationService = require('onf-core-model-ap/applicationPattern/onfModel/services/ForwardingConstructAutomationServices');
const prepareForwardingConfiguration = require('./individualServices/PrepareForwardingConfiguration');
const prepareForwardingAutomation = require('./individualServices/PrepareForwardingAutomation');
const prepareALTForwardingAutomation = require('onf-core-model-ap-bs/basicServices/services/PrepareALTForwardingAutomation');

const httpClientInterface = require('onf-core-model-ap/applicationPattern/onfModel/models/layerProtocols/HttpClientInterface');

const onfAttributeFormatter = require('onf-core-model-ap/applicationPattern/onfModel/utility/OnfAttributeFormatter');

const onfAttributes = require('onf-core-model-ap/applicationPattern/onfModel/constants/OnfAttributes');

const logicalTerminationPoint = require('onf-core-model-ap/applicationPattern/onfModel/models/LogicalTerminationPoint');
const ConfigurationStatus = require('onf-core-model-ap/applicationPattern/onfModel/services/models/ConfigurationStatus');
const LogicalTerminationPointConfigurationStatus = require('onf-core-model-ap/applicationPattern/onfModel/services/models/logicalTerminationPoint/ConfigurationStatus');
const tcpClientInterface = require('onf-core-model-ap/applicationPattern/onfModel/models/layerProtocols/TcpClientInterface');
const ForwardingDomain = require('onf-core-model-ap/applicationPattern/onfModel/models/ForwardingDomain');
const ForwardingConstruct = require('onf-core-model-ap/applicationPattern/onfModel/models/ForwardingConstruct');

const softwareUpgrade = require('./individualServices/SoftwareUpgrade');
const TcpServerInterface = require('onf-core-model-ap/applicationPattern/onfModel/models/layerProtocols/TcpServerInterface');
const FcPort = require('onf-core-model-ap/applicationPattern/onfModel/models/FcPort');
const { getIndexAliasAsync, createResultArray, elasticsearchService } = require('onf-core-model-ap/applicationPattern/services/ElasticsearchService');
const individualServicesOperationsMapping = require('./individualServices/IndividualServicesOperationsMapping');

const REDIRECT_SERVICE_REQUEST_OPERATION = '/v1/redirect-service-request-information';

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

      let newReleaseHttpUuid = await trackNewRelease();
      let newReleaseTcpUuid = (await logicalTerminationPoint.getServerLtpListAsync(newReleaseHttpUuid))[0];

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
      if (newProtocol !== currentRemoteProtocol){
        isUpdated.protocol = await tcpClientInterface.setRemoteProtocolAsync(newReleaseTcpUuid, newProtocol);
      }

      /**
       * Data transfer is not required if the address and port didn't change (Comparing NewRelease
       * with current application).
       */
      let isDataTransferRequired = true;
      let address = await TcpServerInterface.getLocalAddress();
      let port = await TcpServerInterface.getLocalPort();
      if (!isAddressChanged(currentRemoteAddress, address) && (currentRemotePort === port)) {
        isDataTransferRequired = false;
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
        false,
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

      softwareUpgrade.upgradeSoftwareVersion(isDataTransferRequired, newReleaseHttpUuid, user, xCorrelator, traceIndicator, customerJourney)
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
exports.disregardApplication = function (body, user, originator, xCorrelator, traceIndicator, customerJourney, operationServerName) {
  return new Promise(async function (resolve, reject) {
    try {

      /****************************************************************************************
       * Setting up required local variables from the request body
       ****************************************************************************************/
      let applicationName = body["application-name"];
      let applicationReleaseNumber = body["release-number"];

      /****************************************************************************************
       * Prepare logicalTerminatinPointConfigurationInput object to 
       * configure logical-termination-point
       ****************************************************************************************/

      let logicalTerminationPointconfigurationStatus = await LogicalTerminationPointService.deleteApplicationInformationAsync(
        applicationName,
        applicationReleaseNumber
      );

      /****************************************************************************************
       * Prepare attributes to configure forwarding-construct
       ****************************************************************************************/

      let forwardingConfigurationInputList = [];
      let forwardingConstructConfigurationStatus;
      let operationClientConfigurationStatusList = logicalTerminationPointconfigurationStatus.operationClientConfigurationStatusList;

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

      /****************************************************************************************
       * Prepare attributes to automate forwarding-construct
       ****************************************************************************************/
      let forwardingAutomationInputList = await prepareALTForwardingAutomation.getALTUnConfigureForwardingAutomationInputAsync(
        logicalTerminationPointconfigurationStatus,
        forwardingConstructConfigurationStatus
      );

      ForwardingAutomationService.automateForwardingConstructAsync(
        operationServerName,
        forwardingAutomationInputList,
        user,
        xCorrelator,
        traceIndicator,
        customerJourney
      );

      resolve();
    } catch (error) {
      reject(error);
    }
  });
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
exports.listApplications = function (user, originator, xCorrelator, traceIndicator, customerJourney) {
  return new Promise(async function (resolve, reject) {
    let response = {};
    try {
      /****************************************************************************************
       * Preparing response body
       ****************************************************************************************/
      let applicationList = await getAllApplicationList();

      /****************************************************************************************
       * Setting 'application/json' response body
       ****************************************************************************************/
      response['application/json'] = onfAttributeFormatter.modifyJsonObjectKeysToKebabCase(applicationList);
    } catch (error) {
      console.log(error);
    }
    if (Object.keys(response).length > 0) {
      resolve(response[Object.keys(response)[0]]);
    } else {
      resolve();
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
  let numberOfRecords = body["number-of-records"];
  let latest = body["latest-record"];
  let indexAlias = await getIndexAliasAsync();
  let client = await elasticsearchService.getClient(false);
  const result = await client.search({
    index: indexAlias,
    from: latest,
    size: numberOfRecords,
    body: {
      query: {
        match_all: {}
      }
    }
  });
  const resultArray = createResultArray(result);
  return { "response": resultArray, "took": result.body.took };
}


/**
 * Provides list of service request records belonging to the same flow
 *
 * body V1_listrecordsofflow_body
 * returns List
 **/
exports.listRecordsOfFlow = async function (body) {
    let numberOfRecords = body["number-of-records"];
    let latest = body["latest-match"];
    let desiredXCorrelator = body["x-correlator"];
    let indexAlias = await getIndexAliasAsync();
    let client = await elasticsearchService.getClient(false);
    const result = await client.search({
      index: indexAlias,
      from: latest,
      size: numberOfRecords,
      body: {
        query: {
          term: {
            "x-correlator": desiredXCorrelator
          }
        }
      }
    });
    const resultArray = createResultArray(result);
    return { "response": resultArray, "took": result.body.took };
}


/**
 * Provides list of unsuccessful service requests
 *
 * body V1_listrecordsofunsuccessful_body
 * returns List
 **/
exports.listRecordsOfUnsuccessful = async function (body) {
  let numberOfRecords = body["number-of-records"];
  let latest = body["latest-unsuccessful"];
  let indexAlias = await getIndexAliasAsync();
  let client = await elasticsearchService.getClient(false);
  const result = await client.search({
    index: indexAlias,
    from: latest,
    size: numberOfRecords,
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
  });
  const resultArray = createResultArray(result);
  return { "response": resultArray, "took": result.body.took };
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
exports.regardApplication = function (body, user, originator, xCorrelator, traceIndicator, customerJourney, operationServerName) {
  return new Promise(async function (resolve, reject) {
    try {

      /****************************************************************************************
       * Setting up required local variables from the request body
       ****************************************************************************************/
      let applicationName = body['application-name'];
      let releaseNumber = body['release-number'];
      const tcpInfo = [{
        "address": body['address'],
        "protocol": body['protocol'],
        "port": body['port']
      }]

      /****************************************************************************************
       * Prepare logicalTerminatinPointConfigurationInput object to 
       * configure logical-termination-point
       ****************************************************************************************/

      let operationNamesByAttributes = new Map();
      operationNamesByAttributes.set("redirect-service-request-operation", REDIRECT_SERVICE_REQUEST_OPERATION);
      let logicalTerminationPointConfigurationInput = new LogicalTerminationPointConfigurationInput(
        applicationName,
        releaseNumber,
        tcpInfo,
        operationServerName,
        operationNamesByAttributes,
        individualServicesOperationsMapping.individualServicesOperationsMapping
      );
      let logicalTerminationPointconfigurationStatus = await LogicalTerminationPointService.findOrCreateApplicationInformationAsync(
        logicalTerminationPointConfigurationInput
      );


      /****************************************************************************************
       * Prepare attributes to configure forwarding-construct
       ****************************************************************************************/

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

      /****************************************************************************************
       * Prepare attributes to automate forwarding-construct
       ****************************************************************************************/
      let applicationLayerTopologyForwardingInputList = await prepareALTForwardingAutomation.getALTForwardingAutomationInputAsync(
        logicalTerminationPointconfigurationStatus,
        forwardingConstructConfigurationStatus
      );
      let forwardingAutomationInputList = await prepareForwardingAutomation.regardApplication(
        applicationLayerTopologyForwardingInputList,
        applicationName,
        releaseNumber
      );
      ForwardingAutomationService.automateForwardingConstructAsync(
        operationServerName,
        forwardingAutomationInputList,
        user,
        xCorrelator,
        traceIndicator,
        customerJourney
      );

      resolve();
    } catch (error) {
      reject(error);
    }
  });
}

/****************************************************************************************
 * Functions utilized by individual services
 ****************************************************************************************/

async function trackNewRelease() {
  let forwardingConstruct = await ForwardingDomain.getForwardingConstructForTheForwardingNameAsync('PromptForBequeathingDataCausesTransferOfListOfApplications');
  let fcPorts = await ForwardingConstruct.getFcPortListAsync(forwardingConstruct.uuid);
  let fcPort = fcPorts.find(fcp => fcp[onfAttributes.FC_PORT.PORT_DIRECTION] === FcPort.portDirectionEnum.OUTPUT);
  let operationClientUuid = fcPort[onfAttributes.FC_PORT.LOGICAL_TERMINATION_POINT];
  let serverLtpList = await logicalTerminationPoint.getServerLtpListAsync(operationClientUuid);
  return serverLtpList[0];
}

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

/**
 * @description This function returns list of registered application information application-name, release-number,
 * address, protocol and port.
 * @return {Promise} return the list of application information
 * <b><u>Procedure :</u></b><br>
 * <b>step 1 :</b> Get forwarding-construct based on ForwardingName
 * <b>step 2 :</b> Get forwarding-construct UUID
 * <b>step 3 :</b> Get fc-port list using forwarding-construct UUID
 * <b>step 4 :</b> Fetch http-client-list using logical-termination-point uuid from fc-port
 * <b>step 5 :</b> get the application name, release number and server-ltp<br>
 * <b>step 6 :</b> get the ipaddress, port and protocol name of each associated tcp-client <br>
 **/
function getAllApplicationList() {
  return new Promise(async function (resolve, reject) {
    let clientApplicationList = [];
    const forwardingName = "ApprovedApplicationCausesRequestForServiceRequestInformation";
    try {
      let forwardingConstructForTheForwardingName = await ForwardingDomain.getForwardingConstructForTheForwardingNameAsync(forwardingName);
      let forwardingConstructUuid = forwardingConstructForTheForwardingName[onfAttributes.GLOBAL_CLASS.UUID];
      let fcPortList = await ForwardingConstruct.getFcPortListAsync(forwardingConstructUuid);
      let httpClientUuidList = []

      for (let fcPort of fcPortList) {
        if (fcPort[onfAttributes.FC_PORT.PORT_DIRECTION] === FcPort.portDirectionEnum.OUTPUT){
            let serverLtpList = await logicalTerminationPoint.getServerLtpListAsync(fcPort[onfAttributes.FC_PORT.LOGICAL_TERMINATION_POINT])
            httpClientUuidList = httpClientUuidList.concat(serverLtpList)
        }
      }
      for (let httpClientUuid of httpClientUuidList) {
        let applicationName = await httpClientInterface.getApplicationNameAsync(httpClientUuid);
        let applicationReleaseNumber = await httpClientInterface.getReleaseNumberAsync(httpClientUuid);
        let serverLtp = await logicalTerminationPoint.getServerLtpListAsync(httpClientUuid);
        let tcpClientUuid = serverLtp[0];
        let applicationAddress = await tcpClientInterface.getRemoteAddressAsync(tcpClientUuid);
        let applicationPort = await tcpClientInterface.getRemotePortAsync(tcpClientUuid);
        let applicationProtocol = await tcpClientInterface.getRemoteProtocolAsync(tcpClientUuid)

        let application = {};
        application.applicationName = applicationName,
        application.releaseNumber = applicationReleaseNumber,
        application.protocol = applicationProtocol,
        application.address = applicationAddress,
        application.port = applicationPort,

        clientApplicationList.push(application);
      }
      resolve(clientApplicationList);
    } catch (error) {
      reject();
    }
  });
}
