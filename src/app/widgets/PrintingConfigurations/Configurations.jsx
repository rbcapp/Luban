import React, { PureComponent } from 'react';
import PropTypes from 'prop-types';
import { connect } from 'react-redux';
import Select from 'react-select';
import classNames from 'classnames';
import includes from 'lodash/includes';
import Anchor from '../../components/Anchor';
import Notifications from '../../components/Notifications';
import OptionalDropdown from '../../components/OptionalDropdown';
import TipTrigger from '../../components/TipTrigger';
import { NumberInput as Input } from '../../components/Input';
import i18n from '../../lib/i18n';
import confirm from '../../lib/confirm';
import widgetStyles from '../styles.styl';
import { actions as printingActions } from '../../flux/printing';
import { actions as projectActions } from '../../flux/project';
import { HEAD_3DP } from '../../constants';

import styles from './styles.styl';

const OFFICIAL_CONFIG_KEYS = [
    'layer_height',
    'top_thickness',
    'infill_sparse_density',
    // 'speed_print',
    'speed_infill',
    'speed_wall_0',
    'speed_wall_x',
    'speed_travel'
];


function isDefinitionEditable(definition) {
    return !definition.metadata.readonly;
}
function isOfficialDefinition(definition) {
    return includes(['quality.fast_print',
        'quality.normal_quality',
        'quality.high_quality'], definition.definitionId);
}

// config type: official ('fast print', 'normal quality', 'high quality'); custom: ...
// do all things by 'config name'
class Configurations extends PureComponent {
    static propTypes = {
        setTitle: PropTypes.func.isRequired,
        isAdvised: PropTypes.bool.isRequired,
        defaultQualityId: PropTypes.string.isRequired,
        qualityDefinitions: PropTypes.array.isRequired,
        updateDefinitionSettings: PropTypes.func.isRequired,
        updateActiveDefinition: PropTypes.func.isRequired,
        duplicateQualityDefinition: PropTypes.func.isRequired,
        removeQualityDefinition: PropTypes.func.isRequired,
        updateQualityDefinitionName: PropTypes.func.isRequired,
        onDownloadQualityDefinition: PropTypes.func.isRequired,
        onUploadQualityDefinition: PropTypes.func.isRequired,

        updateDefaultAdvised: PropTypes.func.isRequired,
        updateDefaultQualityId: PropTypes.func.isRequired
    };

    fileInput = React.createRef();

    state = {
        // control UI
        notificationMessage: '',
        showOfficialConfigDetails: true,


        // rename custom config
        newName: null,
        isRenaming: false,


        customConfigGroup: [
            {
                name: i18n._('Quality'),
                expanded: false,
                fields: [
                    'layer_height',
                    'layer_height_0',
                    'initial_layer_line_width_factor'
                ]
            },
            {
                name: i18n._('Shell'),
                expanded: false,
                fields: [
                    'wall_thickness',
                    'top_thickness',
                    'bottom_thickness',
                    'outer_inset_first'
                ]
            },
            {
                name: i18n._('Infill'),
                expanded: false,
                fields: [
                    'infill_sparse_density'
                ]
            },
            {
                name: i18n._('Speed'),
                expanded: false,
                fields: [
                    // 'speed_print',
                    'speed_print_layer_0',
                    'speed_infill',
                    'speed_wall_0',
                    'speed_wall_x',
                    'speed_topbottom',
                    'speed_travel',
                    'speed_travel_layer_0'
                ]
            },
            {
                name: i18n._('Retract & Z Hop'),
                expanded: false,
                fields: [
                    'retraction_enable',
                    'retract_at_layer_change',
                    'retraction_amount',
                    'retraction_speed',
                    'retraction_hop_enabled',
                    'retraction_hop'
                ]
            },
            {
                name: i18n._('Surface'),
                expanded: false,
                fields: [
                    'magic_spiralize',
                    'magic_mesh_surface_mode'
                ]
            },
            {
                name: i18n._('Adhesion'),
                expanded: false,
                fields: [
                    'adhesion_type',
                    'skirt_line_count',
                    'brim_line_count',
                    'raft_margin'
                ]
            },
            {
                name: i18n._('Support'),
                expanded: false,
                fields: [
                    'support_enable',
                    'support_type',
                    'support_pattern',
                    'support_infill_rate',
                    'support_angle'
                ]
            }
        ]
    };

    actions = {
        onClickToUpload: () => {
            this.fileInput.current.value = null;
            this.fileInput.current.click();
        },
        onChangeFile: (event) => {
            const file = event.target.files[0];
            this.props.onUploadQualityDefinition(file);
        },
        showNotification: (msg) => {
            this.setState({
                notificationMessage: msg
            });
        },
        clearNotification: () => {
            this.setState({
                notificationMessage: ''
            });
        },
        onSelectOfficialDefinition: (definition) => {
            this.props.updateDefaultQualityId(definition.definitionId);
            this.props.updateActiveDefinition(definition);
        },
        onSelectCustomDefinitionById: (definitionId) => {
            const definition = this.props.qualityDefinitions.find(d => d.definitionId === definitionId);
            // has to update defaultQualityId
            this.props.updateDefaultQualityId(definitionId);
            this.actions.onSelectCustomDefinition(definition);
        },
        onSelectCustomDefinition: (definition) => {
            this.setState({
                isRenaming: false
            });
            // this.props.updateDefaultQualityId(definition.definitionId);
            this.props.updateActiveDefinition(definition);
        },
        // Extended operations
        onChangeNewName: (event) => {
            this.setState({
                newName: event.target.value
            });
        },
        onRenameDefinitionStart: () => {
            if (!this.state.isRenaming) {
                const definition = this.props.qualityDefinitions.find(d => d.definitionId === this.props.defaultQualityId);
                this.setState({
                    isRenaming: true,
                    newName: definition.name
                });
            } else {
                this.actions.onRenameDefinitionEnd();
            }
        },
        onRenameDefinitionEnd: async () => {
            const definition = this.props.qualityDefinitions.find(d => d.definitionId === this.props.defaultQualityId);
            const { newName } = this.state;

            if (newName === definition.name) { // unchanged
                this.setState({
                    isRenaming: false
                });
                return;
            }

            try {
                await this.props.updateQualityDefinitionName(definition, newName);
            } catch (err) {
                this.actions.showNotification(err);
            }

            this.setState({
                isRenaming: false
            });
        },
        onChangeCustomDefinition: (key, value) => {
            const definition = this.props.qualityDefinitions.find(d => d.definitionId === this.props.defaultQualityId);
            if (!isDefinitionEditable(definition)) {
                return;
            }

            definition.settings[key].default_value = value;

            this.props.updateDefinitionSettings(definition, {
                [key]: { default_value: value }
            });
            this.props.updateActiveDefinition({
                ownKeys: [key],
                settings: {
                    [key]: { default_value: value }
                }
            });
        },
        onDuplicateDefinition: async () => {
            const definition = this.props.qualityDefinitions.find(d => d.definitionId === this.props.defaultQualityId);
            const newDefinition = await this.props.duplicateQualityDefinition(definition);

            // Select new definition after creation
            this.actions.onSelectCustomDefinitionById(newDefinition.definitionId);
        },
        onDownloadQualityDefinition: () => {
            const definition = this.props.qualityDefinitions.find(d => d.definitionId === this.props.defaultQualityId);
            this.props.onDownloadQualityDefinition(definition.definitionId);
        },
        onRemoveDefinition: async () => {
            const definition = this.props.qualityDefinitions.find(d => d.definitionId === this.props.defaultQualityId);
            await confirm({
                body: `Are you sure to remove profile "${definition.name}"?`
            });

            await this.props.removeQualityDefinition(definition);
            this.props.updateDefaultQualityId('quality.fast_print');

            // After removal, select the first definition
            if (this.props.qualityDefinitions.length) {
                this.actions.onSelectCustomDefinition(this.props.qualityDefinitions[0]);
            }
        },
        onSetOfficialTab: (isAdvised) => {
            if (isAdvised && /^quality.([0-9_]+)$/.test(this.props.defaultQualityId)) {
                this.props.updateDefaultQualityId('quality.fast_print');
            }
            this.props.updateDefaultAdvised(isAdvised);
        }
    };

    constructor(props) {
        super(props);
        this.props.setTitle(i18n._('Printing Settings'));
    }

    componentWillReceiveProps(nextProps) {
        if (nextProps.qualityDefinitions.length > 0) {
            const qualityDefinition = nextProps.qualityDefinitions.find(d => d.definitionId === nextProps.defaultQualityId);
            if (!qualityDefinition) {
                this.actions.onSelectOfficialDefinition(nextProps.qualityDefinitions[0]);
            }
        }
    }

    render() {
        const { isAdvised, defaultQualityId, qualityDefinitions } = this.props;
        const state = this.state;
        const actions = this.actions;

        const fastPrintDefinition = this.props.qualityDefinitions.find(d => d.definitionId === 'quality.fast_print');
        const normalQualityDefinition = this.props.qualityDefinitions.find(d => d.definitionId === 'quality.normal_quality');
        const highQualityDefinition = this.props.qualityDefinitions.find(d => d.definitionId === 'quality.high_quality');


        const isOfficialTab = isAdvised;
        const qualityDefinition = qualityDefinitions.find(d => d.definitionId === defaultQualityId)
            || qualityDefinitions[0];

        const customDefinitionOptions = qualityDefinitions.map(d => ({
            label: d.name,
            value: d.definitionId
        }));

        if (!qualityDefinition) {
            return null;
        }

        const editable = isDefinitionEditable(qualityDefinition);

        return (
            <div>
                <div className="sm-tabs" style={{ marginTop: '6px', marginBottom: '12px' }}>
                    <button
                        type="button"
                        style={{ width: '50%' }}
                        className={classNames('sm-tab', { 'sm-selected': isOfficialTab })}
                        onClick={() => {
                            this.actions.onSetOfficialTab(true);
                        }}
                    >
                        {i18n._('Recommended')}
                    </button>
                    <button
                        type="button"
                        style={{ width: '50%' }}
                        className={classNames('sm-tab', { 'sm-selected': !isOfficialTab })}
                        onClick={() => {
                            this.actions.onSetOfficialTab(false);
                        }}
                    >
                        {i18n._('Customize')}
                    </button>
                </div>
                {isOfficialTab && (
                    <div className="sm-tabs" style={{ marginTop: '12px' }}>
                        <button
                            type="button"
                            style={{ width: '33.333333%' }}
                            className={classNames('sm-tab', 'sm-tab-large', { 'sm-selected': qualityDefinition === fastPrintDefinition })}
                            onClick={() => {
                                this.actions.onSelectOfficialDefinition(fastPrintDefinition);
                            }}
                        >
                            {i18n._('Fast Print')}
                        </button>
                        <button
                            type="button"
                            style={{ width: '33.333333%' }}
                            className={classNames('sm-tab', 'sm-tab-large', { 'sm-selected': qualityDefinition === normalQualityDefinition })}
                            onClick={() => {
                                this.actions.onSelectOfficialDefinition(normalQualityDefinition);
                            }}
                        >
                            {i18n._('Normal Quality')}
                        </button>
                        <button
                            type="button"
                            style={{ width: '33.333333%' }}
                            className={classNames('sm-tab', 'sm-tab-large', { 'sm-selected': qualityDefinition === highQualityDefinition })}
                            onClick={() => {
                                this.actions.onSelectOfficialDefinition(highQualityDefinition);
                            }}
                        >
                            {i18n._('High Quality')}
                        </button>
                    </div>
                )}
                {isOfficialTab && (
                    <div style={{ marginTop: '12px', marginBottom: '6px' }}>
                        <OptionalDropdown
                            title={i18n._('Show Details')}
                            hidden={!state.showOfficialConfigDetails}
                            onClick={() => {
                                this.setState({ showOfficialConfigDetails: !state.showOfficialConfigDetails });
                            }}
                        >
                            {state.showOfficialConfigDetails && (
                                <table className={styles['config-details-table']}>
                                    <tbody>
                                        {OFFICIAL_CONFIG_KEYS.map((key) => {
                                            const setting = qualityDefinition.settings[key];
                                            const { label, unit } = setting;
                                            const defaultValue = setting.default_value;

                                            return (
                                                <tr key={key}>
                                                    <td>{i18n._(label)}</td>
                                                    <td>
                                                        {defaultValue}
                                                        {unit}
                                                    </td>
                                                </tr>
                                            );
                                        })}
                                    </tbody>
                                </table>
                            )}
                        </OptionalDropdown>
                    </div>
                )}
                {!isOfficialTab && (
                    <div style={{ marginBottom: '6px' }}>
                        <input
                            ref={this.fileInput}
                            type="file"
                            accept=".json"
                            style={{ display: 'none' }}
                            multiple={false}
                            onChange={actions.onChangeFile}
                        />
                        <div>
                            <span style={{
                                width: '100px',
                                lineHeight: '34px',
                                marginRight: '15px'
                            }}
                            >
                                {i18n._('Profile')}
                            </span>
                            <span style={{
                                width: '206px',
                                float: 'right'
                            }}
                            >
                                <Select
                                    backspaceRemoves={false}
                                    clearable={false}
                                    menuContainerStyle={{ zIndex: 5 }}
                                    name="profile"
                                    options={customDefinitionOptions}
                                    placeholder=""
                                    value={qualityDefinition.definitionId}
                                    onChange={(option) => {
                                        this.actions.onSelectCustomDefinitionById(option.value);
                                    }}
                                />
                            </span>
                        </div>
                        <div style={{ marginTop: '10px', color: '#808080' }}>
                            {!state.isRenaming && (
                                <span>{qualityDefinition.name}</span>
                            )}
                            {state.isRenaming && (
                                <React.Fragment>
                                    <input
                                        value={state.newName}
                                        onChange={actions.onChangeNewName}
                                    />
                                    <Anchor
                                        className={classNames('fa', 'fa-check', widgetStyles['fa-btn'])}
                                        onClick={actions.onRenameDefinitionEnd}
                                    />
                                </React.Fragment>
                            )}
                            <div
                                style={{
                                    display: 'inline-block',
                                    float: 'right'
                                }}
                            >
                                {!isOfficialDefinition(qualityDefinition) && (
                                    <Anchor
                                        className={classNames('fa', 'fa-edit', widgetStyles['fa-btn'])}
                                        onClick={actions.onRenameDefinitionStart}
                                    />
                                )}
                                <Anchor
                                    className={classNames('fa', 'fa-upload', widgetStyles['fa-btn'])}
                                    onClick={actions.onClickToUpload}
                                />
                                <Anchor
                                    className={classNames('fa', 'fa-download', widgetStyles['fa-btn'])}
                                    onClick={actions.onDownloadQualityDefinition}
                                />
                                <Anchor
                                    className={classNames('fa', 'fa-plus', widgetStyles['fa-btn'])}
                                    onClick={actions.onDuplicateDefinition}
                                />
                                {!isOfficialDefinition(qualityDefinition) && (
                                    <Anchor
                                        className={classNames('fa', 'fa-trash-o', widgetStyles['fa-btn'])}
                                        onClick={actions.onRemoveDefinition}
                                    />
                                )}
                            </div>
                        </div>
                        <div className={classNames(widgetStyles.separator, widgetStyles['separator-underline'])} />
                        {state.notificationMessage && (
                            <Notifications bsStyle="danger" onDismiss={actions.clearNotification}>
                                {state.notificationMessage}
                            </Notifications>
                        )}
                        <div className="sm-parameter-container">
                            {this.state.customConfigGroup.map((group) => {
                                return (
                                    <div key={group.name}>
                                        <Anchor
                                            className="sm-parameter-header"
                                            onClick={() => {
                                                group.expanded = !group.expanded;
                                                this.setState({
                                                    customConfigGroup: JSON.parse(JSON.stringify(state.customConfigGroup))
                                                });
                                            }}
                                        >
                                            <span className="fa fa-gear sm-parameter-header__indicator" />
                                            <span className="sm-parameter-header__title">{i18n._(group.name)}</span>
                                            <span className={classNames(
                                                'fa',
                                                group.expanded ? 'fa-angle-double-up' : 'fa-angle-double-down',
                                                'sm-parameter-header__indicator',
                                                'pull-right',
                                            )}
                                            />
                                        </Anchor>
                                        {group.expanded && group.fields.map((key) => {
                                            const setting = qualityDefinition.settings[key];

                                            const { label, description, type, unit = '', enabled, options } = setting;
                                            const defaultValue = setting.default_value;

                                            if (typeof enabled === 'string') {
                                                if (enabled.indexOf(' and ') !== -1) {
                                                    const andConditions = enabled.split(' and ').map(c => c.trim());
                                                    for (const condition of andConditions) {
                                                        // parse resolveOrValue('adhesion_type') == 'skirt'
                                                        const enabledKey = condition.match("resolveOrValue\\('(.[^)|']*)'") ? condition.match("resolveOrValue\\('(.[^)|']*)'")[1] : null;
                                                        const enabledValue = condition.match("== ?'(.[^)|']*)'") ? condition.match("== ?'(.[^)|']*)'")[1] : null;
                                                        if (enabledKey) {
                                                            if (qualityDefinition.settings[enabledKey]) {
                                                                const value = qualityDefinition.settings[enabledKey].default_value;
                                                                if (value !== enabledValue) {
                                                                    return null;
                                                                }
                                                            }
                                                        } else {
                                                            if (qualityDefinition.settings[condition]) {
                                                                const value = qualityDefinition.settings[condition].default_value;
                                                                if (!value) {
                                                                    return null;
                                                                }
                                                            }
                                                        }
                                                    }
                                                } else {
                                                    const orConditions = enabled.split(' or ')
                                                        .map(c => c.trim());
                                                    let result = false;
                                                    for (const condition of orConditions) {
                                                        if (qualityDefinition.settings[condition]) {
                                                            const value = qualityDefinition.settings[condition].default_value;
                                                            if (value) {
                                                                result = true;
                                                            }
                                                        }
                                                        if (condition.match('(.*) > ([0-9]+)')) {
                                                            const m = condition.match('(.*) > ([0-9]+)');
                                                            const enabledKey = m[1];
                                                            const enabledValue = parseInt(m[2], 10);
                                                            if (qualityDefinition.settings[enabledKey]) {
                                                                const value = qualityDefinition.settings[enabledKey].default_value;
                                                                if (value > enabledValue) {
                                                                    result = true;
                                                                }
                                                            }
                                                        }
                                                        if (condition.match('(.*) < ([0-9]+)')) {
                                                            const m = condition.match('(.*) > ([0-9]+)');
                                                            const enabledKey = m[1];
                                                            const enabledValue = parseInt(m[2], 10);
                                                            if (qualityDefinition.settings[enabledKey]) {
                                                                const value = qualityDefinition.settings[enabledKey].default_value;
                                                                if (value < enabledValue) {
                                                                    result = true;
                                                                }
                                                            }
                                                        }
                                                        if (condition.match("resolveOrValue\\('(.[^)|']*)'")) {
                                                            const m1 = condition.match("resolveOrValue\\('(.[^)|']*)'");
                                                            const m2 = condition.match("== ?'(.[^)|']*)'");
                                                            const enabledKey = m1[1];
                                                            const enabledValue = m2[1];
                                                            if (qualityDefinition.settings[enabledKey]) {
                                                                const value = qualityDefinition.settings[enabledKey].default_value;
                                                                if (value === enabledValue) {
                                                                    result = true;
                                                                }
                                                            }
                                                        }
                                                    }
                                                    if (!result) {
                                                        return null;
                                                    }
                                                }
                                            } else if (typeof enabled === 'boolean' && enabled === false) {
                                                return null;
                                            }

                                            const opts = [];
                                            if (options) {
                                                Object.keys(options).forEach((k) => {
                                                    opts.push({
                                                        value: k,
                                                        label: i18n._(options[k])
                                                    });
                                                });
                                            }
                                            return (
                                                <TipTrigger title={i18n._(label)} content={i18n._(description)} key={key}>
                                                    <div className="sm-parameter-row" key={key}>
                                                        <span className="sm-parameter-row__label-lg">{i18n._(label)}</span>
                                                        {type === 'float' && (
                                                            <Input
                                                                className="sm-parameter-row__input"
                                                                value={defaultValue}
                                                                disabled={!editable}
                                                                onChange={(value) => {
                                                                    actions.onChangeCustomDefinition(key, value);
                                                                }}
                                                            />
                                                        )}
                                                        {type === 'float' && <span className="sm-parameter-row__input-unit">{unit}</span>}
                                                        {type === 'int' && (
                                                            <Input
                                                                className="sm-parameter-row__input"
                                                                value={defaultValue}
                                                                disabled={!editable}
                                                                onChange={(value) => {
                                                                    actions.onChangeCustomDefinition(key, value);
                                                                }}
                                                            />
                                                        )}
                                                        {type === 'int' && <span className="sm-parameter-row__input-unit">{unit}</span>}
                                                        {type === 'bool' && (
                                                            <input
                                                                className="sm-parameter-row__checkbox"
                                                                type="checkbox"
                                                                checked={defaultValue}
                                                                disabled={!editable}
                                                                onChange={(event) => actions.onChangeCustomDefinition(key, event.target.checked)}
                                                            />
                                                        )}
                                                        {type === 'enum' && (
                                                            <Select
                                                                className="sm-parameter-row__select"
                                                                backspaceRemoves={false}
                                                                clearable={false}
                                                                menuContainerStyle={{ zIndex: 5 }}
                                                                name={key}
                                                                disabled={!editable}
                                                                options={opts}
                                                                searchable={false}
                                                                value={defaultValue}
                                                                onChange={(option) => {
                                                                    actions.onChangeCustomDefinition(key, option.value);
                                                                }}
                                                            />
                                                        )}
                                                    </div>
                                                </TipTrigger>
                                            );
                                        })
                                        }
                                    </div>
                                );
                            })}
                        </div>
                        <div className={widgetStyles.separator} />
                    </div>
                )}
            </div>
        );
    }
}

const mapStateToProps = (state) => {
    const { qualityDefinitions, defaultQualityId, isAdvised, activeDefinition } = state.printing;
    return {
        qualityDefinitions,
        defaultQualityId,
        isAdvised,
        activeDefinition
    };
};

const mapDispatchToProps = (dispatch) => {
    return {
        updateDefaultAdvised: (isAdvised) => dispatch(printingActions.updateState({ 'isAdvised': isAdvised })),
        updateDefaultQualityId: (defaultQualityId) => dispatch(printingActions.updateState({ defaultQualityId })),
        updateActiveDefinition: (definition) => {
            dispatch(printingActions.updateActiveDefinition(definition));
            dispatch(projectActions.autoSaveEnvironment(HEAD_3DP, true));
        },
        duplicateQualityDefinition: (definition) => dispatch(printingActions.duplicateQualityDefinition(definition)),
        onDownloadQualityDefinition: (definitionId) => dispatch(printingActions.onDownloadQualityDefinition(definitionId)),
        onUploadQualityDefinition: (file) => dispatch(printingActions.onUploadQualityDefinition(file)),
        removeQualityDefinition: (definition) => dispatch(printingActions.removeQualityDefinition(definition)),
        updateQualityDefinitionName: (definition, name) => dispatch(printingActions.updateQualityDefinitionName(definition, name)),
        updateDefinitionSettings: (definition, settings) => dispatch(printingActions.updateDefinitionSettings(definition, settings))
    };
};

export default connect(mapStateToProps, mapDispatchToProps)(Configurations);
