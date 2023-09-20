import React, {useEffect} from 'react';
import PropTypes from 'prop-types';
import _ from 'underscore';
import CONST from '../CONST';
import ScreenWrapper from '../components/ScreenWrapper';
import HeaderWithBackButton from '../components/HeaderWithBackButton';
import Navigation from '../libs/Navigation/Navigation';
import useLocalize from '../hooks/useLocalize';
import DistanceRequest from '../components/DistanceRequest';
import reportPropTypes from './reportPropTypes';
import * as IOU from '../libs/actions/IOU';
import * as Transaction from '../libs/actions/Transaction';
import * as TransactionUtils from '../libs/TransactionUtils';
import transactionPropTypes from '../components/transactionPropTypes';

const propTypes = {
    /** The transactionID we're currently editing */
    transactionID: PropTypes.string.isRequired,

    /** The report to with which the distance request is associated */
    report: reportPropTypes.isRequired,

    /** Passed from the navigator */
    route: PropTypes.shape({
        /** Parameters the route gets */
        params: PropTypes.shape({
            /** Type of IOU */
            iouType: PropTypes.oneOf(_.values(CONST.IOU.MONEY_REQUEST_TYPE)),
            /** Id of the report on which the distance request is being created */
            reportID: PropTypes.string,
        }),
    }).isRequired,

    /* Onyx props */
    /** The original transaction that is being edited */
    transaction: transactionPropTypes,
};

const defaultProps = {
    transaction: {},
};

function EditRequestDistancePage({transactionID, report, route, transaction}) {
    const {translate} = useLocalize();

    // This temporary transaction will be the one that all changes are made to. This keeps the original transaction unmodified until
    // the user takes an explicit action to save it.
    const transactionToEdit = TransactionUtils.createTemporaryTransaction(transaction);
    useEffect(() => {
        IOU.setDistanceRequestTransactionID(transactionID);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    // When this component is unmounted, the temporary transaction is removed.
    // This works for both saving a transaction or cancelling out of the flow somehow.
    useEffect(() => () => TransactionUtils.removeTemporaryTransaction(transactionToEdit.transactionID), [transactionToEdit]);

    /**
     * Save the changes to the original transaction object
     * @param {Object} waypoints
     */
    const saveTransaction = (waypoints) => {
        // Pass the transactionID of the original transaction so that is updated on the server
        IOU.updateDistanceRequest(transaction.transactionID, report.reportID, {waypoints});
    };

    return (
        <ScreenWrapper
            includeSafeAreaPaddingBottom={false}
            shouldEnableMaxHeight
        >
            <HeaderWithBackButton
                title={translate('common.distance')}
                onBackButtonPress={() => Navigation.goBack()}
            />
            <DistanceRequest
                report={report}
                route={route}
                // Pass the ID of the cloned transaction so that the original transaction is not being changed
                transactionID={transactionToEdit.transactionID}
                onSubmit={saveTransaction}
                isEditingRequest
            />
        </ScreenWrapper>
    );
}

EditRequestDistancePage.propTypes = propTypes;
EditRequestDistancePage.defaultProps = defaultProps;
EditRequestDistancePage.displayName = 'EditRequestDistancePage';
export default withOnyx({
    transaction: {
        key: (props) => `${ONYXKEYS.COLLECTION.TRANSACTION}${props.transactionID}`,
    },
})(EditRequestDistancePage);
