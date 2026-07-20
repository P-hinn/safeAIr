const safairModdle = {
  name: 'safAIr',
  uri: 'https://safair.local/schema/bpmn',
  prefix: 'safair',
  xml: { tagAlias: 'lowerCase' },
  types: [
    {
      name: 'GovernedFlowNode',
      extends: ['bpmn:FlowNode'],
      properties: [
        { name: 'owner', isAttr: true, type: 'String' },
        { name: 'department', isAttr: true, type: 'String' },
        { name: 'risk', isAttr: true, type: 'String' },
        { name: 'executionMode', isAttr: true, type: 'String' },
        { name: 'automationPotential', isAttr: true, type: 'String' },
        { name: 'humanApproval', isAttr: true, type: 'Boolean' },
        { name: 'control', isAttr: true, type: 'String' },
        { name: 'toolIds', isAttr: true, type: 'String' },
        { name: 'workflowType', isAttr: true, type: 'String' }
      ]
    },
    {
      name: 'GovernedProcess',
      extends: ['bpmn:Process'],
      properties: [
        { name: 'owner', isAttr: true, type: 'String' },
        { name: 'status', isAttr: true, type: 'String' },
        { name: 'maturity', isAttr: true, type: 'Integer' },
        { name: 'volume', isAttr: true, type: 'String' },
        { name: 'landscapeLayer', isAttr: true, type: 'String' },
        { name: 'domain', isAttr: true, type: 'String' },
        { name: 'relations', isAttr: true, type: 'String' }
      ]
    }
  ]
} as const

export default safairModdle
