import Stripe = require("stripe");
import chai = require("chai");

export async function assertErrorThunksAreEqual(actual: () => Promise<any>, expected: () => Promise<any>, message?: string): Promise<void> {
    let actualError: any;
    try {
        await actual();
    } catch (err) {
        actualError = err;
    }

    let expectedError: any;
    try {
        await expected();
    } catch (err) {
        expectedError = err;
    }

    chai.assert.isDefined(actualError, `actual is rejected ${message || ""}`);
    chai.assert.isDefined(expectedError, `expected is rejected ${message || ""}`);
    assertErrorsAreEqual(actualError, expectedError, message);
}

const comparableErrorKeys = ["code", "rawType", "statusCode", "type"];
const comparableRawErrorKeys = ["code", "decline_code", "doc_url", "param", "type"];
export function assertErrorsAreEqual(actual: any, expected: any, message?: string): void {
    for (const key of comparableErrorKeys) {
        chai.assert.deepEqual(actual[key], expected[key], `comparing key '${key}' ${message || ""}`);
    }
    for (const key of comparableRawErrorKeys) {
        chai.assert.deepEqual(actual.raw[key], expected.raw[key], `comparing key 'raw.${key}' ${message || ""}`);
    }
}

export type ComparableStripeObject = Error
    | Stripe.IList<any>
    | Stripe.cards.ICard
    | Stripe.charges.ICharge
    | Stripe.customers.ICustomer
    | Stripe.disputes.IDispute
    | Stripe.refunds.IRefund;

export function assertObjectsAreBasicallyEqual(actual: ComparableStripeObject, expected: ComparableStripeObject, message?: string): void {
    chai.assert.isDefined(actual, message);
    chai.assert.isNotNull(actual, message);
    chai.assert.isDefined(expected, message);
    chai.assert.isNotNull(expected, message);

    if (actual instanceof Error) {
        chai.assert.instanceOf(expected, Error, message);
        assertErrorsAreEqual(actual, expected, message);
        return;
    }
    if (expected instanceof Error) {
        chai.assert.fail(actual as any, expected, `both should be errors ${message}`);
        return;
    }

    chai.assert.equal(actual.object, expected.object, message);
    switch (actual.object) {
        case "card":
            assertCardsAreBasicallyEqual(actual as Stripe.cards.ICard, expected as Stripe.cards.ICard, message);
            break;
        case "charge":
            assertChargesAreBasicallyEqual(actual as Stripe.charges.ICharge, expected as Stripe.charges.ICharge, message);
            break;
        case "customer":
            assertCustomersAreBasicallyEqual(actual as Stripe.customers.ICustomer, expected as Stripe.customers.ICustomer, message);
            break;
        case "dispute":
            assertDisputesAreBasicallyEqual(actual as Stripe.disputes.IDispute, expected as Stripe.disputes.IDispute, message);
            break;
        case "list":
            assertListsAreBasicallyEqual(actual as Stripe.IList<any>, expected as Stripe.IList<any>, message);
            break;
        case "refund":
            assertRefundsAreBasicallyEqual(actual as Stripe.refunds.IRefund, expected as Stripe.refunds.IRefund, message);
            break;
        default:
            throw new Error(`Unhandle Stripe object type: ${actual.object}`);
    }
}

export function assertListsAreBasicallyEqual<T extends ComparableStripeObject>(actual: Stripe.IList<T>, expected: Stripe.IList<T>, message?: string): void {
    chai.assert.lengthOf(actual.data, expected.data.length, message);
    chai.assert.equal(actual.has_more, expected.has_more, message);
    chai.assert.equal(actual.object, expected.object, message);
    chai.assert.equal(actual.total_count, expected.total_count, message);

    for (let ix = 0; ix < actual.data.length; ix++) {
        assertObjectsAreBasicallyEqual(actual.data[ix], expected.data[ix], message);
    }
}

const chargeComparableKeys: (keyof Stripe.charges.ICharge)[] = ["object", "amount", "amount_refunded", "application_fee", "application_fee_amount", "billing_details", "captured", "currency", "description", "failure_code", "failure_message", "metadata", "paid", "receipt_email", "refunded", "statement_descriptor", "statement_descriptor_suffix", "status", "transfer_group"];
export function assertChargesAreBasicallyEqual(actual: Stripe.charges.ICharge, expected: Stripe.charges.ICharge, message?: string): void {
    chai.assert.match(actual.id, /^ch_/, `actual charge ID is formatted correctly ${message}`);

    for (const key of chargeComparableKeys) {
        chai.assert.deepEqual(actual[key], expected[key], `comparing key '${key}' ${message || ""}`);
    }
    chai.assert.equal(actual.refunds.total_count, expected.refunds.total_count, message);
    chai.assert.lengthOf(actual.refunds.data, actual.refunds.total_count, message);

    assertOutcomesAreBasicallyEqual(actual.outcome, expected.outcome, message);
    assertListsAreBasicallyEqual(actual.refunds, expected.refunds, message);
}

const outcomeComparableKeys: (keyof Stripe.charges.IOutcome)[] = ["network_status", "reason", "risk_level", "rule", "seller_message", "type"];
function assertOutcomesAreBasicallyEqual(actual: Stripe.charges.IOutcome, expected: Stripe.charges.IOutcome, message?: string): void {
    for (const key of outcomeComparableKeys) {
        chai.assert.deepEqual(actual[key], expected[key], `comparing key '${key}' ${message || ""}`);
    }
}

const refundComparableKeys: (keyof Stripe.refunds.IRefund)[] = ["object", "amount", "currency", "description", "metadata", "reason", "status"];
export function assertRefundsAreBasicallyEqual(actual: Stripe.refunds.IRefund, expected: Stripe.refunds.IRefund, message?: string): void {
    for (const key of refundComparableKeys) {
        chai.assert.deepEqual(actual[key], expected[key], `comparing key '${key}' ${message || ""}`);
    }
}

const customerKeys: (keyof Stripe.customers.ICustomer)[] = ["object", "account_balance", "address", "balance", "currency", "delinquent", "description", "discount", "email", "invoice_settings", "livemode", "metadata", "name", "phone", "preferred_locales", "shipping"];
export function assertCustomersAreBasicallyEqual(actual: Stripe.customers.ICustomer, expected: Stripe.customers.ICustomer, message?: string): void {
    for (const key of customerKeys) {
        chai.assert.deepEqual(actual[key], expected[key], `comparing key '${key}' ${message || ""}`);
    }
    chai.assert.equal(!!actual.default_source, !!expected.default_source, `both have default_source set or unset ${message}`);
    chai.assert.equal(actual.sources.total_count, expected.sources.total_count, message);
    chai.assert.lengthOf(actual.sources.data, actual.sources.total_count, message);

    for (let sourceIx = 0; sourceIx < expected.sources.total_count; sourceIx++) {
        chai.assert.equal(actual.sources.data[sourceIx].object, "card", "only card checking is supported");
        chai.assert.equal(expected.sources.data[sourceIx].object, "card", "only card checking is supported");
        chai.assert.equal((actual.sources.data[sourceIx] as Stripe.cards.ICard).customer, actual.id);
        chai.assert.equal((expected.sources.data[sourceIx] as Stripe.cards.ICard).customer, expected.id);
        assertCardsAreBasicallyEqual(actual.sources.data[sourceIx] as Stripe.cards.ICard, expected.sources.data[sourceIx] as Stripe.cards.ICard, `of refund ${sourceIx} ${message || ""}`);
    }
}

const cardKeys: (keyof Stripe.cards.ICard)[] = ["object", "address_city", "address_country", "address_line1", "address_line1_check", "address_line2", "address_state", "address_zip", "address_zip_check", "brand", "country", "cvc_check", "dynamic_last4", "exp_month", "exp_year", "funding", "last4", "metadata", "name", "tokenization_method"];
export function assertCardsAreBasicallyEqual(actual: Stripe.cards.ICard, expected: Stripe.cards.ICard, message?: string): void {
    for (const key of cardKeys) {
        chai.assert.deepEqual(actual[key], expected[key], `comparing key '${key}' ${message || ""}`);
    }
}

const disputeKeys: (keyof Stripe.disputes.IDispute)[] = ["object", "amount", "currency", "is_charge_refundable", "livemode", "metadata", "reason", "status"];
export function assertDisputesAreBasicallyEqual(actual: Stripe.disputes.IDispute, expected: Stripe.disputes.IDispute, message?: string): void {
    for (const key of disputeKeys) {
        chai.assert.deepEqual(actual[key], expected[key], `comparing key '${key}' ${message || ""}`);
    }
}
