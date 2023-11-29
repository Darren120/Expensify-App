import Onyx from 'react-native-onyx';
import * as API from '@libs/API';
import * as Localize from '@libs/Localize';
import CONST from '@src/CONST';
import ONYXKEYS from '@src/ONYXKEYS';
import {Response} from '@src/types/onyx';

function reportVirtualExpensifyCardFraud(cardID: number) {
    type ReportVirtualExpensifyCardFraudParams = {
        cardID: number;
    };

    const reportVirtualExpensifyCardFraudParams: ReportVirtualExpensifyCardFraudParams = {
        cardID,
    };

    API.write('ReportVirtualExpensifyCardFraud', reportVirtualExpensifyCardFraudParams, {
        optimisticData: [
            {
                onyxMethod: Onyx.METHOD.MERGE,
                key: ONYXKEYS.FORMS.REPORT_VIRTUAL_CARD_FRAUD,
                value: {
                    isLoading: true,
                },
            },
        ],
        successData: [
            {
                onyxMethod: Onyx.METHOD.MERGE,
                key: ONYXKEYS.FORMS.REPORT_VIRTUAL_CARD_FRAUD,
                value: {
                    isLoading: false,
                },
            },
        ],
        failureData: [
            {
                onyxMethod: Onyx.METHOD.MERGE,
                key: ONYXKEYS.FORMS.REPORT_VIRTUAL_CARD_FRAUD,
                value: {
                    isLoading: false,
                },
            },
        ],
    });
}

/**
 * Call the API to deactivate the card and request a new one
 * @param cardId - id of the card that is going to be replaced
 * @param reason - reason for replacement ('damaged' | 'stolen')
 */
function requestReplacementExpensifyCard(cardId: number, reason: string) {
    type RequestReplacementExpensifyCardParams = {
        cardId: number;
        reason: string;
    };

    const requestReplacementExpensifyCardParams: RequestReplacementExpensifyCardParams = {
        cardId,
        reason,
    };

    API.write('RequestReplacementExpensifyCard', requestReplacementExpensifyCardParams, {
        optimisticData: [
            {
                onyxMethod: Onyx.METHOD.MERGE,
                key: ONYXKEYS.FORMS.REPORT_PHYSICAL_CARD_FORM,
                value: {
                    isLoading: true,
                    errors: null,
                },
            },
        ],
        successData: [
            {
                onyxMethod: Onyx.METHOD.MERGE,
                key: ONYXKEYS.FORMS.REPORT_PHYSICAL_CARD_FORM,
                value: {
                    isLoading: false,
                },
            },
        ],
        failureData: [
            {
                onyxMethod: Onyx.METHOD.MERGE,
                key: ONYXKEYS.FORMS.REPORT_PHYSICAL_CARD_FORM,
                value: {
                    isLoading: false,
                },
            },
        ],
    });
}

/**
 * Activates the physical Expensify card based on the last four digits of the card number
 */
function activatePhysicalExpensifyCard(cardLastFourDigits: string, cardID: number) {
    type ActivatePhysicalExpensifyCardParams = {
        cardLastFourDigits: string;
        cardID: number;
    };

    const activatePhysicalExpensifyCardParams: ActivatePhysicalExpensifyCardParams = {
        cardLastFourDigits,
        cardID,
    };

    API.write('ActivatePhysicalExpensifyCard', activatePhysicalExpensifyCardParams, {
        optimisticData: [
            {
                onyxMethod: Onyx.METHOD.MERGE,
                key: ONYXKEYS.CARD_LIST,
                value: {
                    [cardID]: {
                        errors: null,
                        isLoading: true,
                    },
                },
            },
        ],
        successData: [
            {
                onyxMethod: Onyx.METHOD.MERGE,
                key: ONYXKEYS.CARD_LIST,
                value: {
                    [cardID]: {
                        isLoading: false,
                    },
                },
            },
        ],
        failureData: [
            {
                onyxMethod: Onyx.METHOD.MERGE,
                key: ONYXKEYS.CARD_LIST,
                value: {
                    [cardID]: {
                        isLoading: false,
                    },
                },
            },
        ],
    });
}

/**
 * Clears errors for a specific cardID
 */
function clearCardListErrors(cardID: number) {
    Onyx.merge(ONYXKEYS.CARD_LIST, {[cardID]: {errors: null, isLoading: false}});
}

/**
 * Makes an API call to get virtual card details (pan, cvv, expiration date, address)
 * This function purposefully uses `makeRequestWithSideEffects` method. For security reason
 * card details cannot be persisted in Onyx and have to be asked for each time a user want's to
 * reveal them.
 *
 * @param cardID - virtual card ID
 *
 * @returns promise with card details object
 */
function revealVirtualCardDetails(cardID: number): Promise<Response> {
    return new Promise((resolve, reject) => {
        type RevealExpensifyCardDetailsParams = {cardID: number};

        const revealExpensifyCardDetailsParams: RevealExpensifyCardDetailsParams = {cardID};

        // eslint-disable-next-line rulesdir/no-api-side-effects-method
        API.makeRequestWithSideEffects('RevealExpensifyCardDetails', revealExpensifyCardDetailsParams)
            .then((response) => {
                if (response?.jsonCode !== CONST.JSON_CODE.SUCCESS) {
                    reject(Localize.translateLocal('cardPage.cardDetailsLoadingFailure'));
                    return;
                }
                resolve(response);
            })
            .catch(() => reject(Localize.translateLocal('cardPage.cardDetailsLoadingFailure')));
    });
}

export {requestReplacementExpensifyCard, activatePhysicalExpensifyCard, clearCardListErrors, reportVirtualExpensifyCardFraud, revealVirtualCardDetails};
