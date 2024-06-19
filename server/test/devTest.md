|   Service      | type   | Scenario |  configuration      | callbacks   | passed |   issues |
|--------------|-----------|------------|--------------|-----------|------------|--------------|
|/v1/list-applications|Individual Service||NA||yes||
|/v1/record-service-request|Individual Service||NA||yes||
|/v1/list-records|Individual Service||NA||yes||
|/v1/list-records-of-flow|Individual Service||NA||yes||
|/v1/list-records-of-unsuccessful|Individual Service||NA||yes||
|/v1/disregard-application|Individual Service|with existing  value|Remove information of application(http,tcp,opc,andforwarding)|/v1/disregard-application<br>/v1/delete-ltp-and-dependents|yes||
|/v1/disregard-application||with non existing  value|NA|/v1/disregard-application<br>/v1/delete-ltp-and-dependents|yes|| 
|v1/regard-application|Individual Service|with existing  value|NA|/v1/add-operation-client-to-link<br>/v1/redirect-service-request-information<br>/v1/add-operation-client-to-link|Yes|https://github.com/openBackhaul/ExecutionAndTraceLog/issues/366 <br>https://github.com/openBackhaul/ExecutionAndTraceLog/issues/364
|/v1/bequeath-your-data-and-die|Individual Service|with new application information|update the details of new relaese information|/v1/regard-application<br>/v1/notify-approvals<br>/v1/notify-withdrawn-approvals<br>/v1/end-subscription<br>/v1/relay-server-replacement<br>/v1/deregister-application|yes|https://github.com/openBackhaul/ExecutionAndTraceLog/issues/367|
