# ExecutionAndTraceLog

### Location
The ExecutionAndTraceLog is part of the TinyApplicationController.  
The TinyApplicationController is for managing the REST microservices of the application layer.  

### Description
Every application that belongs to the application layer sends a record about every processed service request to the ExecutionAndTraceLog.  
The ExecutionAndTraceLog stores these records into an ElasticSearch database.  
Filtering service records for unsuccessfully executed requests or requests belonging to the same flow is supported.  

### Relevance
The ExecutionAndTraceLog is core element of the application layer running in the live network at Telefonica Germany.  

### Resources
- [Specification](./spec/)
- [TestSuite](./testing/)
- [Implementation](./server/)

### Comments
./.
