import { css } from '@emotion/css';
import { capitalize } from 'lodash';
import React from 'react';

import { DataFrame, getFieldDisplayName, GrafanaTheme2, ReducerID, SelectableValue } from '@grafana/data';
import { Select, StatsPicker, useStyles2 } from '@grafana/ui';

import {
  configMapHandlers,
  evaluateFieldMappings,
  FieldToConfigMapHandler,
  FieldToConfigMapping,
  HandlerArguments,
  lookUpConfigHandler as findConfigHandlerFor,
} from '../fieldToConfigMapping/fieldToConfigMapping';

import { FieldConfigMappingHandlerArgumentsEditor } from './FieldConfigMappingHandlerArgumentsEditor';

export interface Props {
  frame: DataFrame;
  mappings: FieldToConfigMapping[];
  onChange: (mappings: FieldToConfigMapping[]) => void;
  withReducers?: boolean;
  withNameAndValue?: boolean;
}

export function FieldToConfigMappingEditor({ frame, mappings, onChange, withReducers, withNameAndValue }: Props) {
  const styles = useStyles2(getStyles);
  const rows = getViewModelRows(frame, mappings, withNameAndValue);
  const configProps = configMapHandlers.map((def) => configHandlerToSelectOption(def, false)) as Array<
    SelectableValue<string>
  >;

  const onChangeConfigProperty = (row: FieldToConfigRowViewModel, value: SelectableValue<string | null>) => {
    const existingIdx = mappings.findIndex((x) => x.fieldName === row.fieldName);

    if (value) {
      if (existingIdx !== -1) {
        const update = [...mappings];
        update.splice(existingIdx, 1, { ...mappings[existingIdx], handlerKey: value.value! });
        onChange(update);
      } else {
        onChange([...mappings, { fieldName: row.fieldName, handlerKey: value.value! }]);
      }
    } else {
      if (existingIdx !== -1) {
        onChange(mappings.filter((x, index) => index !== existingIdx));
      } else {
        onChange([...mappings, { fieldName: row.fieldName, handlerKey: '__ignore' }]);
      }
    }
  };

  const onChangeReducer = (row: FieldToConfigRowViewModel, reducerId: ReducerID) => {
    const existingIdx = mappings.findIndex((x) => x.fieldName === row.fieldName);

    if (existingIdx !== -1) {
      const update = [...mappings];
      update.splice(existingIdx, 1, { ...mappings[existingIdx], reducerId });
      onChange(update);
    } else {
      onChange([...mappings, { fieldName: row.fieldName, handlerKey: row.handlerKey, reducerId }]);
    }
  };

  const onChangeHandlerArguments = (row: FieldToConfigRowViewModel, handlerArguments: HandlerArguments) => {
    const existingIdx = mappings.findIndex((x) => x.fieldName === row.fieldName);

    if (existingIdx !== -1) {
      const update = [...mappings];
      update.splice(existingIdx, 1, { ...mappings[existingIdx], handlerArguments });
      onChange(update);
    } else {
      onChange([...mappings, { fieldName: row.fieldName, handlerKey: row.handlerKey, handlerArguments }]);
    }
  };

  return (
    <table className={styles.table}>
      <thead>
        <tr>
          <th>Field</th>
          <th>Use as</th>
          {withReducers && <th>Select</th>}
        </tr>
      </thead>
      <tbody>
        {rows.map((row) => (
          <tr key={row.fieldName}>
            <td className={styles.labelCell}>{row.fieldName}</td>
            <td className={styles.selectCell} data-testid={`${row.fieldName}-config-key`}>
              <Select
                options={configProps}
                value={row.configOption}
                placeholder={row.placeholder}
                isClearable={true}
                onChange={(value) => onChangeConfigProperty(row, value)}
              />
            </td>
            {withReducers && (
              <td data-testid={`${row.fieldName}-reducer`} className={styles.selectCell}>
                <StatsPicker
                  stats={[row.reducerId]}
                  defaultStat={row.reducerId}
                  onChange={(stats: string[]) => onChangeReducer(row, stats[0] as ReducerID)}
                />
              </td>
            )}
            <td>
              <FieldConfigMappingHandlerArgumentsEditor
                handlerKey={row.handlerKey}
                handlerArguments={row.handlerArguments}
                onChange={(args) => onChangeHandlerArguments(row, args)}
              />
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

interface FieldToConfigRowViewModel {
  handlerKey: string | null;
  fieldName: string;
  configOption: SelectableValue<string | null> | null;
  placeholder?: string;
  missingInFrame?: boolean;
  reducerId: string;
  handlerArguments: HandlerArguments;
}

function getViewModelRows(
  frame: DataFrame,
  mappings: FieldToConfigMapping[],
  withNameAndValue?: boolean
): FieldToConfigRowViewModel[] {
  const rows: FieldToConfigRowViewModel[] = [];
  const mappingResult = evaluateFieldMappings(frame, mappings ?? [], withNameAndValue);

  for (const field of frame.fields) {
    const fieldName = getFieldDisplayName(field, frame);
    const mapping = mappingResult.index[fieldName];
    const option = configHandlerToSelectOption(mapping.handler, mapping.automatic);

    rows.push({
      fieldName,
      configOption: mapping.automatic ? null : option,
      placeholder: mapping.automatic ? option?.label : 'Choose',
      handlerKey: mapping.handler?.key ?? null,
      reducerId: mapping.reducerId,
      handlerArguments: mapping.handlerArguments,
    });
  }

  // Add rows for mappings that have no matching field
  for (const mapping of mappings) {
    if (!rows.find((x) => x.fieldName === mapping.fieldName)) {
      const handler = findConfigHandlerFor(mapping.handlerKey);

      rows.push({
        fieldName: mapping.fieldName,
        handlerKey: mapping.handlerKey,
        configOption: configHandlerToSelectOption(handler, false),
        missingInFrame: true,
        reducerId: mapping.reducerId ?? ReducerID.lastNotNull,
        handlerArguments: {},
      });
    }
  }

  return Object.values(rows);
}

function configHandlerToSelectOption(
  def: FieldToConfigMapHandler | null,
  isAutomatic: boolean
): SelectableValue<string> | null {
  if (!def) {
    return null;
  }

  let name = def.name ?? capitalize(def.key);

  if (isAutomatic) {
    name = `${name} (auto)`;
  }

  return {
    label: name,
    value: def.key,
  };
}

const getStyles = (theme: GrafanaTheme2) => ({
  table: css`
    margin-top: ${theme.spacing(1)};

    td,
    th {
      border-right: 4px solid ${theme.colors.background.primary};
      border-bottom: 4px solid ${theme.colors.background.primary};
      white-space: nowrap;
    }
    th {
      font-size: ${theme.typography.bodySmall.fontSize};
      line-height: ${theme.spacing(4)};
      padding: ${theme.spacing(0, 1)};
    }
  `,
  labelCell: css`
    font-size: ${theme.typography.bodySmall.fontSize};
    background: ${theme.colors.background.secondary};
    padding: ${theme.spacing(0, 1)};
    max-width: 400px;
    overflow: hidden;
    text-overflow: ellipsis;
    min-width: 140px;
  `,
  selectCell: css`
    padding: 0;
    min-width: 161px;
  `,
});
