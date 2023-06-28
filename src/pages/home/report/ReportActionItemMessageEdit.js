import lodashGet from 'lodash/get';
import React, {useState, useRef, useMemo, useEffect, useCallback} from 'react';
import {InteractionManager, Keyboard, View} from 'react-native';
import PropTypes from 'prop-types';
import _ from 'underscore';
import ExpensiMark from 'expensify-common/lib/ExpensiMark';
import Str from 'expensify-common/lib/str';
import reportActionPropTypes from './reportActionPropTypes';
import styles from '../../../styles/styles';
import themeColors from '../../../styles/themes/default';
import * as StyleUtils from '../../../styles/StyleUtils';
import Composer from '../../../components/Composer';
import * as Report from '../../../libs/actions/Report';
import * as ReportScrollManager from '../../../libs/ReportScrollManager';
import openReportActionComposeViewWhenClosingMessageEdit from '../../../libs/openReportActionComposeViewWhenClosingMessageEdit';
import ReportActionComposeFocusManager from '../../../libs/ReportActionComposeFocusManager';
import EmojiPickerButton from '../../../components/EmojiPicker/EmojiPickerButton';
import Icon from '../../../components/Icon';
import * as Expensicons from '../../../components/Icon/Expensicons';
import Tooltip from '../../../components/Tooltip';
import * as ReportActionContextMenu from './ContextMenu/ReportActionContextMenu';
import * as ReportUtils from '../../../libs/ReportUtils';
import * as EmojiUtils from '../../../libs/EmojiUtils';
import reportPropTypes from '../../reportPropTypes';
import ExceededCommentLength from '../../../components/ExceededCommentLength';
import CONST from '../../../CONST';
import refPropTypes from '../../../components/refPropTypes';
import * as ComposerUtils from '../../../libs/ComposerUtils';
import * as ComposerActions from '../../../libs/actions/Composer';
import * as User from '../../../libs/actions/User';
import PressableWithFeedback from '../../../components/Pressable/PressableWithFeedback';
import Hoverable from '../../../components/Hoverable';
import useLocalize from '../../../hooks/useLocalize';
import useKeyboardState from '../../../hooks/useKeyboardState';
import useWindowDimensions from '../../../hooks/useWindowDimensions';

const propTypes = {
    /** All the data of the action */
    action: PropTypes.shape(reportActionPropTypes).isRequired,

    /** Draft message */
    draftMessage: PropTypes.string.isRequired,

    /** ReportID that holds the comment we're editing */
    reportID: PropTypes.string.isRequired,

    /** Position index of the report action in the overall report FlatList view */
    index: PropTypes.number.isRequired,

    /** A ref to forward to the text input */
    forwardedRef: refPropTypes,

    /** The report currently being looked at */
    // eslint-disable-next-line react/no-unused-prop-types
    report: reportPropTypes,

    /** Whether or not the emoji picker is disabled */
    shouldDisableEmojiPicker: PropTypes.bool,

    /** Stores user's preferred skin tone */
    preferredSkinTone: PropTypes.oneOfType([PropTypes.number, PropTypes.string]),
};

const defaultProps = {
    forwardedRef: () => {},
    report: {},
    shouldDisableEmojiPicker: false,
    preferredSkinTone: CONST.EMOJI_DEFAULT_SKIN_TONE,
};

// native ids
const saveButtonID = 'saveButton';
const cancelButtonID = 'cancelButton';
const emojiButtonID = 'emojiButton';
const messageEditInput = 'messageEditInput';

function ReportActionItemMessageEdit(props) {
    const {translate} = useLocalize();
    const {isKeyboardShown} = useKeyboardState();
    const {isSmallScreenWidth} = useWindowDimensions();

    const [draft, setDraft] = useState(() => {
        if (props.draftMessage === props.action.message[0].html) {
            // We only convert the report action message to markdown if the draft message is unchanged.
            const parser = new ExpensiMark();
            return parser.htmlToMarkdown(props.draftMessage).trim();
        }
        // We need to decode saved draft message because it's escaped before saving.
        return Str.htmlDecode(props.draftMessage);
    });
    const [selection, setSelection] = useState({start: 0, end: 0});
    const [isFocused, setIsFocused] = useState(false);
    const [hasExceededMaxCommentLength, setHasExceededMaxCommentLength] = useState(false);

    const textInputRef = useRef(null);
    const isFocusedRef = useRef(false);

    useEffect(() => {
        // required for keeping last state of isFocused variable
        isFocusedRef.current = isFocused;
    }, [isFocused]);

    useEffect(() => {
        // For mobile Safari, updating the selection prop on an unfocused input will cause it to automatically gain focus
        // and subsequent programmatic focus shifts (e.g., modal focus trap) to show the blue frame (:focus-visible style),
        // so we need to ensure that it is only updated after focus.
        setDraft((prevDraft) => {
            setSelection({
                start: prevDraft.length,
                end: prevDraft.length,
            });
            return prevDraft;
        });

        return () => {
            // Skip if this is not the focused message so the other edit composer stays focused
            if (!isFocusedRef.current) {
                return;
            }

            // Show the main composer when the focused message is deleted from another client
            // to prevent the main composer stays hidden until we swtich to another chat.
            ComposerActions.setShouldShowComposeInput(true);
        };
    }, []);

    /**
     * Save the draft of the comment. This debounced so that we're not ceaselessly saving your edit. Saving the draft
     * allows one to navigate somewhere else and come back to the comment and still have it in edit mode.
     * @param {String} newDraft
     */
    const debouncedSaveDraft = useMemo(
        () =>
            _.debounce((newDraft) => {
                Report.saveReportActionDraft(props.reportID, props.action.reportActionID, newDraft);
            }, 1000),
        [props.reportID, props.action.reportActionID],
    );

    /**
     * Update the value of the draft in Onyx
     *
     * @param {String} newDraftInput
     */
    const updateDraft = useCallback(
        (newDraftInput) => {
            const {text: newDraft = '', emojis = []} = EmojiUtils.replaceEmojis(newDraftInput, props.preferredSkinTone);

            if (!_.isEmpty(emojis)) {
                User.updateFrequentlyUsedEmojis(EmojiUtils.getFrequentlyUsedEmojis(emojis));
            }
            setDraft((prevDraft) => {
                if (newDraftInput !== newDraft) {
                    setSelection((prevSelection) => {
                        const remainder = prevDraft.slice(prevSelection.end).length;
                        return {
                            start: newDraft.length - remainder,
                            end: newDraft.length - remainder,
                        };
                    });
                }
                return newDraft;
            });

            // This component is rendered only when draft is set to a non-empty string. In order to prevent component
            // unmount when user deletes content of textarea, we set previous message instead of empty string.
            if (newDraft.trim().length > 0) {
                // We want to escape the draft message to differentiate the HTML from the report action and the HTML the user drafted.
                debouncedSaveDraft(_.escape(newDraft));
            } else {
                debouncedSaveDraft(props.action.message[0].html);
            }
        },
        [props.action.message, debouncedSaveDraft, props.preferredSkinTone],
    );

    /**
     * Delete the draft of the comment being edited. This will take the comment out of "edit mode" with the old content.
     */
    const deleteDraft = useCallback(() => {
        debouncedSaveDraft.cancel();
        Report.saveReportActionDraft(props.reportID, props.action.reportActionID, '');
        ComposerActions.setShouldShowComposeInput(true);
        ReportActionComposeFocusManager.focus();

        // Scroll to the last comment after editing to make sure the whole comment is clearly visible in the report.
        if (props.index === 0) {
            const keyboardDidHideListener = Keyboard.addListener('keyboardDidHide', () => {
                ReportScrollManager.scrollToIndex({animated: true, index: props.index}, false);
                keyboardDidHideListener.remove();
            });
        }
    }, [props.action.reportActionID, debouncedSaveDraft, props.index, props.reportID]);

    /**
     * Save the draft of the comment to be the new comment message. This will take the comment out of "edit mode" with
     * the new content.
     */
    const publishDraft = useCallback(() => {
        // Do nothing if draft exceed the character limit
        if (ReportUtils.getCommentLength(draft) > CONST.MAX_COMMENT_LENGTH) {
            return;
        }

        // To prevent re-mount after user saves edit before debounce duration (example: within 1 second), we cancel
        // debounce here.
        debouncedSaveDraft.cancel();

        const trimmedNewDraft = draft.trim();

        // If the reportActionID and parentReportActionID are the same then the user is editing the first message of a
        // thread and we should pass the parentReportID instead of the reportID of the thread
        const reportID = props.report.parentReportActionID === props.action.reportActionID ? props.report.parentReportID : props.reportID;

        // When user tries to save the empty message, it will delete it. Prompt the user to confirm deleting.
        if (!trimmedNewDraft) {
            ReportActionContextMenu.showDeleteModal(reportID, props.action, false, deleteDraft, () => InteractionManager.runAfterInteractions(() => textInputRef.current.focus()));
            return;
        }
        Report.editReportComment(reportID, props.action, trimmedNewDraft);
        deleteDraft();
    }, [props.action, debouncedSaveDraft, deleteDraft, draft, props.reportID, props.report]);

    /**
     * @param {String} emoji
     */
    const addEmojiToTextBox = (emoji) => {
        const isEmojiAtEnd = selection.start === draft.length;

        setSelection((prevSelection) => ({
            start: prevSelection.start + emoji.length + (isEmojiAtEnd ? CONST.SPACE_LENGTH : 0),
            end: prevSelection.start + emoji.length + (isEmojiAtEnd ? CONST.SPACE_LENGTH : 0),
        }));
        updateDraft(ComposerUtils.insertText(draft, selection, isEmojiAtEnd ? `${emoji} ` : emoji));
    };

    /**
     * Key event handlers that short cut to saving/canceling.
     *
     * @param {Event} e
     */
    const triggerSaveOrCancel = useCallback(
        (e) => {
            if (!e || ComposerUtils.canSkipTriggerHotkeys(isSmallScreenWidth, isKeyboardShown)) {
                return;
            }
            if (e.key === CONST.KEYBOARD_SHORTCUTS.ENTER.shortcutKey && !e.shiftKey) {
                e.preventDefault();
                publishDraft();
            } else if (e.key === CONST.KEYBOARD_SHORTCUTS.ESCAPE.shortcutKey) {
                e.preventDefault();
                deleteDraft();
            }
        },
        [deleteDraft, isKeyboardShown, isSmallScreenWidth, publishDraft],
    );

    return (
        <>
            <View style={[styles.chatItemMessage, styles.flexRow]}>
                <View style={[styles.justifyContentEnd]}>
                    <Tooltip text={translate('common.cancel')}>
                        <Hoverable>
                            {(hovered) => (
                                <PressableWithFeedback
                                    onPress={deleteDraft}
                                    style={styles.chatItemSubmitButton}
                                    nativeID={cancelButtonID}
                                    accessibilityRole="button"
                                    accessibilityLabel={translate('common.close')}
                                    // disable dimming
                                    hoverDimmingValue={1}
                                    pressDimmingValue={1}
                                    hoverStyle={StyleUtils.getButtonBackgroundColorStyle(CONST.BUTTON_STATES.ACTIVE)}
                                    pressStyle={StyleUtils.getButtonBackgroundColorStyle(CONST.BUTTON_STATES.PRESSED)}
                                >
                                    <Icon
                                        src={Expensicons.Close}
                                        fill={StyleUtils.getIconFillColor(hovered ? CONST.BUTTON_STATES.ACTIVE : CONST.BUTTON_STATES.DEFAULT)}
                                    />
                                </PressableWithFeedback>
                            )}
                        </Hoverable>
                    </Tooltip>
                </View>
                <View
                    style={[
                        isFocused ? styles.chatItemComposeBoxFocusedColor : styles.chatItemComposeBoxColor,
                        styles.flexRow,
                        styles.flex1,
                        styles.chatItemComposeBox,
                        hasExceededMaxCommentLength && styles.borderColorDanger,
                    ]}
                >
                    <View style={styles.textInputComposeSpacing}>
                        <Composer
                            multiline
                            ref={(el) => {
                                textInputRef.current = el;
                                // eslint-disable-next-line no-param-reassign
                                props.forwardedRef.current = el;
                            }}
                            nativeID={messageEditInput}
                            onChangeText={updateDraft} // Debounced saveDraftComment
                            onKeyPress={triggerSaveOrCancel}
                            value={draft}
                            maxLines={isSmallScreenWidth ? CONST.COMPOSER.MAX_LINES_SMALL_SCREEN : CONST.COMPOSER.MAX_LINES} // This is the same that slack has
                            style={[styles.textInputCompose, styles.flex1, styles.bgTransparent]}
                            onFocus={() => {
                                setIsFocused(true);
                                ReportScrollManager.scrollToIndex({animated: true, index: props.index}, true);
                                ComposerActions.setShouldShowComposeInput(false);
                            }}
                            onBlur={(event) => {
                                setIsFocused(false);
                                const relatedTargetId = lodashGet(event, 'nativeEvent.relatedTarget.id');

                                // Return to prevent re-render when save/cancel button is pressed which cancels the onPress event by re-rendering
                                if (_.contains([saveButtonID, cancelButtonID, emojiButtonID], relatedTargetId)) {
                                    return;
                                }

                                if (messageEditInput === relatedTargetId) {
                                    return;
                                }
                                openReportActionComposeViewWhenClosingMessageEdit();
                            }}
                            selection={selection}
                            onSelectionChange={(e) => setSelection(e.nativeEvent.selection)}
                        />
                    </View>
                    <View style={styles.editChatItemEmojiWrapper}>
                        <EmojiPickerButton
                            isDisabled={props.shouldDisableEmojiPicker}
                            onModalHide={() => InteractionManager.runAfterInteractions(() => textInputRef.current.focus())}
                            onEmojiSelected={addEmojiToTextBox}
                            nativeID={emojiButtonID}
                        />
                    </View>

                    <View style={styles.alignSelfEnd}>
                        <Tooltip text={translate('common.saveChanges')}>
                            <PressableWithFeedback
                                style={[styles.chatItemSubmitButton, hasExceededMaxCommentLength ? {} : styles.buttonSuccess]}
                                onPress={publishDraft}
                                nativeID={saveButtonID}
                                disabled={hasExceededMaxCommentLength}
                                accessibilityRole="button"
                                accessibilityLabel={translate('common.saveChanges')}
                                hoverDimmingValue={1}
                                pressDimmingValue={0.2}
                            >
                                <Icon
                                    src={Expensicons.Checkmark}
                                    fill={hasExceededMaxCommentLength ? themeColors.icon : themeColors.textLight}
                                />
                            </PressableWithFeedback>
                        </Tooltip>
                    </View>
                </View>
            </View>
            <ExceededCommentLength
                comment={draft}
                onExceededMaxCommentLength={(hasExceeded) => setHasExceededMaxCommentLength(hasExceeded)}
            />
        </>
    );
}

ReportActionItemMessageEdit.propTypes = propTypes;
ReportActionItemMessageEdit.defaultProps = defaultProps;
ReportActionItemMessageEdit.displayName = 'ReportActionItemMessageEdit';

export default React.forwardRef((props, ref) => (
    <ReportActionItemMessageEdit
        // eslint-disable-next-line react/jsx-props-no-spreading
        {...props}
        forwardedRef={ref}
    />
));
