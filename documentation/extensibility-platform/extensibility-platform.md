# VMware Cloud Foundation Automation Extensibility Platform Overview

VMware Cloud Foundation Automation Extensibility Platform provides a set of capabilities that enable developers and Cloud Service Providers (CSPs) to build and offer additional cloud services in their portfolio. Partner Services provide the necessary capabilities for simple lifecycle management and they are built on top of the multiple capabilities of the Extensibility Platform. For more details on each capability, refer to the sections below and review the technical information in the detailed guides.

## UI Extensibility

Through the UI Extensibility framework, developers can create custom plugins that integrate seamlessly into the VMware Cloud Foundation Automation user interface. The UI plugins serve the role of the frontend for Partner services, allowing Cloud Providers and Tenants to manage and consume value added services. UI Plugins are developed using the Angular and Clarity frameworks, but in some cases, other technology stacks might be required. This is why UI Plugins also support iFrames.

More details for all UI Extensibility capabilities and tooling can be found [here](ui-plugins.md).

## Message broker

The backbone of many of the extensibility framework technologies is a [message bus](message-broker.md). Extension backends communicate with, or monitor various system processes and events. Currently, there are two message busses - one for the AMQP protocol, which is backed by a provider's own RabbitMQ server, and one for the MQTT protocol which is embedded in VMware Cloud Foundation Automation. AMQP is being slowly phased out in favour of MQTT and will eventually be completely removed.

## Notifications and Events

Notifications and Events are mechanisms that provide real-time information about activities, changes, and status updates within the VCF Automation Provider Management environment. These features allow Partner services to monitor and respond to events that occur in the cloud infrastructure and enable various monitoring, alerting, automation and external system integration usecases.

VMware Cloud Foundation Automation Notifications and Events are consumed using the [MQTT protocol](message-broker.md).

## API Extensibility

VMware Cloud Foundation Automation provides an [API Extensibility](api-extensibility.md) feature that allows defining custom API endpoints that integrate seamlessly into VMware Cloud Foundation Automation REST API layer. Partner services can leverage this capability to enable new services that can be consumed by either UI Plugins or API users and scripts. The additional APIs require a backend to process the request information and respond in the proper fashion. 

The API Extensibility Framework allows VMware Cloud Foundation Automation to act as a transparent proxy to any REST API that the VCFA appliance has network connectivity to but the API caller does not. This approach, combined with the iFrame support of UI Plugins, enables quick and low-effort integrations with other Cloud Services and Systems.

## Runtime Defined Entities and Behaviors

[Runtime Defined Entities](defined-entities/defined-entities-overview.md) (RDE) allow Partner services to create custom objects through the VMware Cloud Foundation Automation API and persist them into the VMware Cloud Foundation Automation's database. The RDEs enable use cases like managing the desired state of external resources and storing the state of an extension. In addition to extending the database, the RDE framework introduces different types of behaviors such as Webhook and MQTT that can be used to interact with the data stored in the Runtime Defined Entities.

RDEs additionally provide advanced RBAC and Access Control for each type of object and their instances. These capabilities, combined with behaviors, are a great alternative to a traditional appliance backend that Extensions usually implement.

## Object Metadata

Many core entity types support a notion of a soft schema extension to their main properties. Object metadata gives cloud operators and tenants a flexible way to associate user-defined properties (name=value pairs) with objects.

[Metadata](object-metadata-2.md) is supported for objects managed by the VMware Cloud Foundation Automation `cloudapi`. What is more, the Metadata feature provides a powerful _search-by-metadata_ mechanism.
