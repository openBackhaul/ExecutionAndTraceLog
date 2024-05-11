const TcpServerInterface = require('onf-core-model-ap/applicationPattern/onfModel/models/layerProtocols/TcpServerInterface');
const HttpServerInterface = require('onf-core-model-ap/applicationPattern/onfModel/models/layerProtocols/HttpServerInterface');
const prepareALTForwardingAutomation = require('onf-core-model-ap-bs/basicServices/services/PrepareALTForwardingAutomation');
const onfAttributeFormatter = require('onf-core-model-ap/applicationPattern/onfModel/utility/OnfAttributeFormatter');
const onfAttributes = require('onf-core-model-ap/applicationPattern/onfModel/constants/OnfAttributes');
const FcPort = require('onf-core-model-ap/applicationPattern/onfModel/models/FcPort');
const ForwardingDomain = require('onf-core-model-ap/applicationPattern/onfModel/models/ForwardingDomain');
const OperationClientInterface = require('onf-core-model-ap/applicationPattern/onfModel/models/layerProtocols/OperationClientInterface');
const IntegerProfile = require('onf-core-model-ap/applicationPattern/onfModel/models/profile/IntegerProfile');
const HttpClientInterface = require('onf-core-model-ap/applicationPattern/onfModel/models/layerProtocols/HttpClientInterface');
const ForwardingProcessingInput = require('onf-core-model-ap/applicationPattern/onfModel/services/models/forwardingConstruct/ForwardingProcessingInput');
const ForwardingConstructProcessingService = require('onf-core-model-ap/applicationPattern/onfModel/services/ForwardingConstructProcessingServices');

var traceIndicatorIncrementer = 1;
/**
 * This method performs the set of callback to RegardApplicationCausesSequenceForInquiringServiceRecords
 * @param {String} applicationName from {$request.body#application-name}
 * @param {String} releaseNumber from {$request.body#release-number}
 * @param {String} user User identifier from the system starting the service call
 * @param {String} xCorrelator UUID for the service execution flow that allows to correlate requests and responses
 * @param {String} traceIndicator Sequence of request numbers along the flow
 * @param {String} customerJourney Holds information supporting customer’s journey to which the execution applies
 * @returns {Promise} promise resolved if-successful then successfully-connected-true or if-unsuccessful successfully-connected-false else promise reject
 * The following are the list of forwarding that will be automated to redirect the RegardApplicationCausesSequenceForInquiringServiceRecords
 * 1. CreateLinkForInquiringServiceRecords
 * 2. RequestForInquiringServiceRecords
 * 3. CreateLinkForSendingServiceRecords
 */
exports.regardApplication = function (applicationName, releaseNumber, user, xCorrelator, traceIndicator, customerJourney, _traceIndicatorIncrementer) {
    return new Promise(async function (resolve, reject) {
        try {
            if (_traceIndicatorIncrementer !== 0) {
                traceIndicatorIncrementer = _traceIndicatorIncrementer;
            }
            const result = await CreateLinkForInquiringServiceRecords(applicationName, releaseNumber, user, xCorrelator, traceIndicator, customerJourney)
            if(!result['data']['client-successfully-added'] || result.status != 200){
                resolve(result);
            }
            else{
                let forwardingKindName = "RegardApplicationCausesSequenceForInquiringServiceRecords.RequestForInquiringServiceRecords";
                let clientUuid = await getOperationClientUuuid(forwardingKindName);
                let operationName = await OperationClientInterface.getOperationNameAsync(clientUuid);
                let httpClientUuid = await HttpClientInterface.getHttpClientUuidAsync(applicationName, releaseNumber);
                let operationClientUuid = await OperationClientInterface.getOperationClientUuidAsync(httpClientUuid, operationName);
                let isOperationKeyUpdated = await isOperationKeyUpdatedOrNot(operationClientUuid);
                if(!isOperationKeyUpdated){
                    resolve(
                        { 
                            'successfully-connected': false,
                            'reason-of-failure': "EATL_MAXIMUM_WAIT_TIME_TO_RECEIVE_OPERATION_KEY_EXCEEDED"
                        }
                    );
                }
                else{
                    const result = await RequestForInquiringServiceRecords(user, xCorrelator, traceIndicator, customerJourney)
                    
                    if(result.status != 204){
                        resolve(result);
                    }
                    else{
                        let attempts = 1;
                        let maximumNumberOfAttemptsToCreateLink = await IntegerProfile.getIntegerValueForTheIntegerProfileNameAsync("maximumNumberOfAttemptsToCreateLink");
                        for(let i=0; i < maximumNumberOfAttemptsToCreateLink; i++){
                            const result = await CreateLinkForReceivingServiceRecords(applicationName, releaseNumber, user, xCorrelator, traceIndicator, customerJourney)
                            if((attempts<=maximumNumberOfAttemptsToCreateLink) 
                                && (result.data['client-successfully-added'] == false) 
                                && ((result.data['reason-of-failure'] == "ALT_SERVING_APPLICATION_NAME_UNKNOWN") 
                                || (result.data['reason-of-failure'] == "ALT_SERVING_APPLICATION_RELEASE_NUMBER_UNKNOWN")))
                            {
                                attempts = attempts+1;
                            }else{
                                if(!result.data['client-successfully-added'] || result.status != 200){
                                    resolve(result);
                                    break;
                                }else{
                                    if(!isOperationKeyUpdated){
                                        resolve(
                                            { 
                                                'successfully-connected': false,
                                                'reason-of-failure': "EATL_MAXIMUM_WAIT_TIME_TO_RECEIVE_OPERATION_KEY_EXCEEDED"
                                            }
                                        );
                                        break;
                                    }
                                    else{
                                        resolve(
                                            { 'successfully-connected': true }
                                        );
                                        break;
                                    }
                                }
                            }  
                        }
                        
                    }
                }
            }          
        } catch (error) {
            reject(error);
        }
    });
}

/**
 * Prepare attributes and automate RegardApplicationCausesSequenceForInquiringServiceRecords.CreateLinkForInquiringServiceRecords<br>
 * @param {String} applicationName from {$request.body#application-name}
 * @param {String} releaseNumber from {$request.body#release-number}
 * @param {String} user User identifier from the system starting the service call
 * @param {String} xCorrelator UUID for the service execution flow that allows to correlate requests and responses
 * @param {String} traceIndicator Sequence of request numbers along the flow
 * @param {String} customerJourney Holds information supporting customer’s journey to which the execution applies
 * @returns {Promise} if operation success then promise resolved with client-successfully-added: boolean, reason-of-failure: string else promise reject
 */
async function CreateLinkForInquiringServiceRecords(applicationName, releaseNumber, user, xCorrelator, traceIndicator, customerJourney) {
        return new Promise(async function (resolve, reject) {
            try {
                let forwardingKindNameOfInquiringServiceRecords = "RegardApplicationCausesSequenceForInquiringServiceRecords.CreateLinkForInquiringServiceRecords";
                let result;
                try {
                    let requestBody = {};
                    let forwardingKindName = "RegardApplicationCausesSequenceForInquiringServiceRecords.RequestForInquiringServiceRecords";
                    let operationClientUuid = await getOperationClientUuuid(forwardingKindName);
                    let operationName = await OperationClientInterface.getOperationNameAsync(operationClientUuid);
                    requestBody['serving-application-name'] = applicationName;
                    requestBody['serving-application-release-number'] = releaseNumber;
                    requestBody['operation-name'] = operationName;
                    requestBody['consuming-application-name'] = await HttpServerInterface.getApplicationNameAsync();
                    requestBody['consuming-application-release-number'] = await HttpServerInterface.getReleaseNumberAsync();    
                    requestBody = onfAttributeFormatter.modifyJsonObjectKeysToKebabCase(requestBody);
                    
                    let forwardingAutomation = new ForwardingProcessingInput(
                        forwardingKindNameOfInquiringServiceRecords,
                        requestBody
                    );
                    result = await ForwardingConstructProcessingService.processForwardingConstructAsync(
                        forwardingAutomation,
                        user,
                        xCorrelator,
                        traceIndicator + "." + traceIndicatorIncrementer++,
                        customerJourney
                    );
                } catch (error) {
                    console.log(error);
                    throw "operation is not success";
                }
                resolve(result);                
            } catch (error) {
                reject(error);
            }
        });
}

/**
 * This method performs the set of callback to RegardApplicationCausesSequenceForInquiringServiceRecords
 * @param {String} user User identifier from the system starting the service call
 * @param {String} xCorrelator UUID for the service execution flow that allows to correlate requests and responses
 * @param {String} traceIndicator Sequence of request numbers along the flow
 * @param {String} customerJourney Holds information supporting customer’s journey to which the execution applies
 * @returns {Promise} Promise is resolved if the operation succeeded else the Promise is rejected
 */
async function RequestForInquiringServiceRecords(user, xCorrelator, traceIndicator, customerJourney) {
    return new Promise(async function (resolve, reject) {
        try {
            /********************************************************************************************************
             * RegardApplicationCausesSequenceForInquiringServiceRecords.RequestForInquiringServiceRecords /v1/redirect-service-request-information
             ********************************************************************************************************/
            let redirectServiceRequestForwardingName = "RegardApplicationCausesSequenceForInquiringServiceRecords.RequestForInquiringServiceRecords";
            let redirectServiceRequestRequestBody = {};
            let result;
            try {
                let forwardingKindName = "ServiceRequestCausesLoggingRequest";
                let operationClientUuid = await getOperationClientUuuid(forwardingKindName);
                let operationName = await OperationClientInterface.getOperationNameAsync(operationClientUuid);
                redirectServiceRequestRequestBody.serviceLogApplication = await HttpServerInterface.getApplicationNameAsync();
                redirectServiceRequestRequestBody.serviceLogApplicationReleaseNumber = await HttpServerInterface.getReleaseNumberAsync();
                redirectServiceRequestRequestBody.serviceLogOperation = operationName;
                redirectServiceRequestRequestBody.serviceLogAddress = await TcpServerInterface.getLocalAddressForForwarding();
                redirectServiceRequestRequestBody.serviceLogPort = await TcpServerInterface.getLocalPort();
                redirectServiceRequestRequestBody.serviceLogProtocol = await TcpServerInterface.getLocalProtocol();
                redirectServiceRequestRequestBody = onfAttributeFormatter.modifyJsonObjectKeysToKebabCase(redirectServiceRequestRequestBody);
                
                let forwardingAutomation = new ForwardingProcessingInput(
                    redirectServiceRequestForwardingName,
                    redirectServiceRequestRequestBody
                 );
                result = await ForwardingConstructProcessingService.processForwardingConstructAsync(
                    forwardingAutomation,
                    user,
                    xCorrelator,
                    traceIndicator + "." + traceIndicatorIncrementer++,
                    customerJourney
                );

            } catch (error) {
                console.log(error);
                throw "operation is not success";
            }
            resolve(result);
        } catch (error) {
            reject(error);
        }
    });
}

/**
 * Prepare attributes and automate RegardApplicationCausesSequenceForInquiringServiceRecords.CreateLinkForSendingServiceRecords<br>
 * @param {String} applicationName from {$request.body#application-name}
 * @param {String} releaseNumber from {$request.body#release-number}
 * @param {String} user User identifier from the system starting the service call
 * @param {String} xCorrelator UUID for the service execution flow that allows to correlate requests and responses
 * @param {String} traceIndicator Sequence of request numbers along the flow
 * @param {String} customerJourney Holds information supporting customer’s journey to which the execution applies
 * @returns {Promise} if operation success then promise resolved with client-successfully-added: boolean, reason-of-failure: string else promise reject
 */
async function CreateLinkForReceivingServiceRecords(applicationName, releaseNumber, user, xCorrelator, traceIndicator, customerJourney) {
    return new Promise(async function (resolve, reject) {
        try {
            let result;
            let forwardingKindNameOfInquiringServiceRecords = "RegardApplicationCausesSequenceForInquiringServiceRecords.CreateLinkForReceivingServiceRecords";
            try {
                let requestBody = {};
                let forwardingKindName = "ServiceRequestCausesLoggingRequest";
                let operationClientUuid = await getOperationClientUuuid(forwardingKindName);
                let operationName = await OperationClientInterface.getOperationNameAsync(operationClientUuid);
                requestBody['serving-application-name'] = await HttpServerInterface.getApplicationNameAsync();
                requestBody['serving-application-release-number'] = await HttpServerInterface.getReleaseNumberAsync();
                requestBody['operation-name'] = operationName;
                requestBody['consuming-application-name'] = applicationName;
                requestBody['consuming-application-release-number'] = releaseNumber;    
                requestBody = onfAttributeFormatter.modifyJsonObjectKeysToKebabCase(requestBody);
                
                let forwardingAutomation = new ForwardingProcessingInput(
                    forwardingKindNameOfInquiringServiceRecords,
                    requestBody
                );
                result = await ForwardingConstructProcessingService.processForwardingConstructAsync(
                    forwardingAutomation,
                    user,
                    xCorrelator,
                    traceIndicator + "." + traceIndicatorIncrementer++,
                    customerJourney
                );
            } catch (error) {
                console.log(error);
                throw "operation is not success";
            }
            resolve(result);
        } catch (error) {
            reject(error);
        }
    });
}

exports.OAMLayerRequest = function (uuid) {
    return new Promise(async function (resolve, reject) {
        try {
            let applicationLayerTopologyForwardingInputList = await prepareALTForwardingAutomation.getALTForwardingAutomationInputForOamRequestAsync(
                uuid
            );
            if (applicationLayerTopologyForwardingInputList) {
                resolve(applicationLayerTopologyForwardingInputList);
            }
        } catch (error) {
            reject(error);
        }
    });
}

function getFcPortOutputLogicalTerminationPointList(forwardingConstructInstance) {
    let fcPortOutputLogicalTerminationPointList = [];
    let fcPortList = forwardingConstructInstance[
        onfAttributes.FORWARDING_CONSTRUCT.FC_PORT];
    for (let i = 0; i < fcPortList.length; i++) {
        let fcPort = fcPortList[i];
        let fcPortPortDirection = fcPort[onfAttributes.FC_PORT.PORT_DIRECTION];
        if (fcPortPortDirection == FcPort.portDirectionEnum.OUTPUT) {
            let fclogicalTerminationPoint = fcPort[onfAttributes.FC_PORT.LOGICAL_TERMINATION_POINT];
            fcPortOutputLogicalTerminationPointList.push(fclogicalTerminationPoint);
        }
    }
    return fcPortOutputLogicalTerminationPointList;
}

function isOperationKeyUpdatedOrNot(operationClientUuid) {
    return new Promise(async function (resolve, reject) {
        try {
            let timestampOfCurrentRequest = new Date();
            OperationClientInterface.turnONNotificationChannel(timestampOfCurrentRequest);
            let waitTime = await IntegerProfile.getIntegerValueForTheIntegerProfileNameAsync("maximumWaitTimeToReceiveOperationKey");
            let result = await OperationClientInterface.waitUntilOperationKeyIsUpdated(operationClientUuid, timestampOfCurrentRequest, waitTime);
            OperationClientInterface.turnOFFNotificationChannel(timestampOfCurrentRequest);
            resolve(result);
        } catch (error) {
            reject(error);
        }
    });
}

function getOperationClientUuuid(forwardingKindName) {
    return new Promise(async function (resolve, reject) {
        try {
            let forwardingConstructInstance = await ForwardingDomain.getForwardingConstructForTheForwardingNameAsync(forwardingKindName);
            let clientUuid = (getFcPortOutputLogicalTerminationPointList(forwardingConstructInstance))[0];
            resolve(clientUuid);
        } catch (error) {
            reject(error);
        }
    });
}
