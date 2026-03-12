// Copyright 2022 Foursquare Labs, Inc. All Rights Reserved.

import type {FC} from 'react';
import {zip, uniq} from 'es-toolkit';
import type {FunctionSuggestion} from '@sqlrooms/db';

export interface FunctionDocumentationProps {
  functions: FunctionSuggestion[];
}

export const FunctionDocumentation: FC<FunctionDocumentationProps> = ({
  functions,
}) => {
  const description = functions[0]?.description;
  const examples = uniq(functions.flatMap((fn) => fn.examples).filter(Boolean));

  if (functions.length === 0) {
    return null;
  }

  return (
    <div className="overflow-x-auto text-sm">
      <FunctionSignatures functions={functions} overloadsToShow={3} />
      {description && <p className="mt-2 italic">{description}</p>}
      {examples.length > 0 && (
        <FunctionExamples examples={examples} examplesToShow={3} />
      )}
    </div>
  );
};

interface FunctionExamplesProps {
  examples: (string | null | undefined)[];
  examplesToShow: number;
}

const FunctionExamples: FC<FunctionExamplesProps> = ({
  examples,
  examplesToShow,
}) => {
  const displayExamples = examples.slice(0, examplesToShow).join('\n');

  if (!displayExamples) {
    return null;
  }

  return (
    <div className="mt-2">
      <p className="font-bold">Examples:</p>
      <pre className="mt-1">{displayExamples}</pre>
    </div>
  );
};

interface FunctionSignaturesProps {
  functions: FunctionSuggestion[];
  overloadsToShow: number;
}

const FunctionSignatures: FC<FunctionSignaturesProps> = ({
  functions,
  overloadsToShow,
}) => {
  const overloadToShow = functions.slice(0, overloadsToShow);
  const moreOverloadsCount = functions.length - overloadToShow.length;

  return (
    <pre>
      {overloadToShow.map((fn, index) => (
        <FunctionSignature key={index} functionMetadata={fn} />
      ))}
      {moreOverloadsCount > 0 && (
        <>
          {'\n'}(+{moreOverloadsCount} more{' '}
          {moreOverloadsCount === 1 ? 'overload' : 'overloads'})
        </>
      )}
    </pre>
  );
};

interface FunctionSignatureProps {
  functionMetadata: FunctionSuggestion;
}

const FunctionSignature: FC<FunctionSignatureProps> = ({functionMetadata}) => {
  const {parameterTypes, parameters, returnType} = functionMetadata;

  return (
    <>
      <span style={{color: 'var(--color-editor-function)'}}>
        {functionMetadata.name}
      </span>
      (
      <FunctionParameters
        parameters={parameters}
        parameterTypes={parameterTypes}
      />
      )
      {returnType && (
        <>
          {' '}
          →{' '}
          <span style={{color: 'var(--color-editor-type)'}}>{returnType}</span>
        </>
      )}
      {'\n'}
    </>
  );
};

interface FunctionParametersProps {
  parameters?: (string | null | undefined)[] | null;
  parameterTypes?: (string | null | undefined)[] | null;
}

const FunctionParameters: FC<FunctionParametersProps> = ({
  parameters,
  parameterTypes,
}) => {
  const tuples = zip(parameters ?? [], parameterTypes ?? []);

  return (
    <>
      {tuples.map(
        (
          [parameterName, parameterType]: [
            string | null | undefined,
            string | null | undefined,
          ],
          index: number,
        ) => {
          if (!parameterName && parameterType) {
            return (
              <span key={index}>
                <span style={{color: 'var(--color-editor-type)'}}>
                  {parameterType}
                </span>
                {index < tuples.length - 1 && ', '}
              </span>
            );
          }

          if (!parameterType && parameterName) {
            return (
              <span key={index}>
                {parameterName}
                {index < tuples.length - 1 && ', '}
              </span>
            );
          }

          if (!parameterName || !parameterType) {
            return null;
          }

          return (
            <span key={index}>
              {parameterName}:{' '}
              <span style={{color: 'var(--color-editor-type)'}}>
                {parameterType}
              </span>
              {index < tuples.length - 1 && ', '}
            </span>
          );
        },
      )}
    </>
  );
};
