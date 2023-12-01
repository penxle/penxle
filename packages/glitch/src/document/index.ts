import fs from 'node:fs/promises';
import path from 'node:path';
import graphql from 'graphql';
import { collectArtifactSources } from './artifact';
import { hash } from './hash';
import { collectSchemaSource } from './schema';
import {
  isFragmentDocumentNode,
  isOperationDocumentNode,
  validateDocumentNode,
  validateDocumentNodes,
} from './validate';
import type { GlitchContext } from '../types';

export const collectDocuments = async (context: GlitchContext) => {
  const schemaSource = await collectSchemaSource(context);
  const artifactSources = await collectArtifactSources(context);

  const schemaHash = hash(schemaSource);
  let schemaRefreshed = false;

  if (schemaHash !== context.state.schemaHash) {
    try {
      context.schema = graphql.parse(schemaSource);
      context.state.schemaHash = schemaHash;
    } catch (err) {
      console.error(`💥 GraphQL schema error`);
      if (err instanceof Error) {
        console.error(`💥 ${err.message}`);
      } else {
        console.error(`💥 ${err}`);
      }

      return {
        success: false,
        refreshed: false,
      };
    }

    schemaRefreshed = true;
  }

  const artifactHashes = artifactSources.map(({ filePath, source }) => hash(filePath + source)).sort((a, b) => a - b);

  const totalHash = hash(schemaHash + artifactHashes.join(''));
  try {
    const fsHash = await fs.readFile(path.join(context.codegenRoot, '.hash'), 'utf8');
    if (String(totalHash) === fsHash) {
      return {
        success: true,
        refreshed: false,
      };
    }
  } catch {
    // noop
  } finally {
    await fs.mkdir(context.codegenRoot, { recursive: true });
    await fs.writeFile(path.join(context.codegenRoot, '.hash'), String(totalHash));
  }

  const removedArtifactNames: string[] = [];
  const addedArtifactNames: string[] = [];

  for (const [i, artifactHash] of context.state.artifactHashes.entries()) {
    if (artifactHashes.includes(artifactHash)) {
      continue;
    }

    removedArtifactNames.push(context.artifacts[i].name);

    context.artifacts.splice(i, 1);
    context.state.artifactHashes.splice(i, 1);
  }

  for (const [i, artifactHash] of artifactHashes.entries()) {
    if (context.state.artifactHashes.includes(artifactHash)) {
      continue;
    }

    const source = artifactSources[i];

    let documentNode;
    try {
      documentNode = graphql.parse(source.source);
    } catch (err) {
      console.error(`💥 GraphQL document error: ${source.filePath}`);
      if (err instanceof Error) {
        console.error(`💥 ${err.message}`);
      } else {
        console.error(`💥 ${err}`);
      }

      return {
        success: false,
        refreshed: false,
      };
    }

    if (!validateDocumentNode(documentNode)) {
      return {
        success: false,
        refreshed: false,
      };
    }

    addedArtifactNames.push(documentNode.definitions[0].name.value);

    context.state.artifactHashes.push(artifactHash);

    if (isOperationDocumentNode(documentNode)) {
      const definition = documentNode.definitions[0];

      context.artifacts.push({
        kind: definition.operation,
        name: definition.name.value,

        filePath: source.filePath,
        source: source.source,

        documentNode,
      });
    } else if (isFragmentDocumentNode(documentNode)) {
      const definition = documentNode.definitions[0];

      context.artifacts.push({
        kind: 'fragment',
        name: definition.name.value,

        filePath: source.filePath,
        source: source.source,

        documentNode,
      });
    }
  }

  if (!validateDocumentNodes(context.artifacts.map(({ documentNode }) => documentNode))) {
    return {
      success: false,
      refreshed: false,
    };
  }

  for (const name of removedArtifactNames) {
    if (!addedArtifactNames.includes(name)) {
      console.log(`📋 ${name} 🧹`);
    }
  }

  for (const name of addedArtifactNames) {
    if (removedArtifactNames.includes(name)) {
      console.log(`📋 ${name} 💫`);
    } else {
      console.log(`📋 ${name} ✨`);
    }
  }

  return {
    success: true,
    refreshed: schemaRefreshed || removedArtifactNames.length > 0 || addedArtifactNames.length > 0,
  };
};
