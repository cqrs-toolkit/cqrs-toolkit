import { type TSESTree, AST_NODE_TYPES } from '@typescript-eslint/typescript-estree'

export function isStringLiteral(node: TSESTree.Node): node is TSESTree.StringLiteral {
  return (
    node.type === AST_NODE_TYPES.Literal && typeof (node as TSESTree.Literal).value === 'string'
  )
}

export function isObjectExpression(node: TSESTree.Node): node is TSESTree.ObjectExpression {
  return node.type === AST_NODE_TYPES.ObjectExpression
}

type o = TSESTree.ObjectExpression
