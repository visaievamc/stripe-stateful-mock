import * as stripe from "stripe";
import log = require("loglevel");
import {AccountData} from "./AccountData"
import { StripeError } from "./StripeError";
import { applyListOptions, generateId, stringifyMetadata } from "./utils";
import { customers } from "./customers"

const FILE_START = Date.now()

export namespace subscriptions {
    const accountSubscriptions = new AccountData<
        stripe.subscriptions.ISubscription
    >();

    export function create(
        accountId: string,
        params: stripe.subscriptions.ISubscriptionCreationOptions
    ): stripe.subscriptions.ISubscription {
        log.debug("subscriptions.create", accountId, params)

        const paramId = (params as any).id
        if (paramId && accountSubscriptions.contains(accountId, paramId)) {
            throw new StripeError(400, {
                code: "resource_already_exists",
                doc_url: "https://stripe.com/docs/error-codes/resource-already-exists",
                message: "Subscription already exists.",
                type: "invalid_request_error"
            });
        }

        let default_source
        let paramsDefaultSource = params.default_source
        if (paramsDefaultSource && typeof paramsDefaultSource !== 'string') {
            const customer = params.customer
            const card = customers.createCard(accountId, customer, {
                source: paramsDefaultSource
            })
            default_source = card.id
        } else if (typeof paramsDefaultSource === 'string') {
            default_source = paramsDefaultSource
        }

        let plan = params.plan
        if (!plan) {
            plan = params.items[0].plan
        }

        const subscriptionId = paramId || `sub_${generateId(14)}`
        const now = Math.floor((Date.now() / 1000))
        const nextMonth = new Date()
        nextMonth.setMonth(nextMonth.getMonth() + 1);
        const subscription: stripe.subscriptions.ISubscription = {
            id: subscriptionId,
            object: "subscription",
            application_fee_percent: +params.application_fee_percent || null,
            billing: params.billing || "charge_automatically",
            collection_method: params.billing || "charge_automatically",
            billing_cycle_anchor: +params.billing_cycle_anchor || now,
            billing_thresholds: null,
            cancel_at: null,
            cancel_at_period_end: false,
            canceled_at: null,
            created: now,
            current_period_end: Math.floor(nextMonth.getTime() / 1000),
            /** Hard coded to assume month long subscriptions */
            current_period_start: now,
            customer: params.customer,
            days_until_due: params.days_until_due || null,
            default_payment_method: null,
            default_source: default_source || null,
            /*default_tax_rates*/
            discount: null,
            ended_at: null,
            items: {
                object: "list",
                total_count: params.items ? params.items.length : 0,
                data: [],
                has_more: false,
                url: `/v1/subscription_items?subscription=${subscriptionId}`
            },
            latest_invoice: `in_${generateId(14)}`,
            livemode: false,
            metadata: stringifyMetadata(params.metadata),
            plan: createPlanObj(plan),
            quantity: params.quantity || 1,
            start: Math.floor(Date.now() / 1000),
            start_date: Math.floor(Date.now() / 1000),
            status: 'active',
            tax_percent: params.tax_percent || null,
            trial_end: null,
            trial_start: null
        }

        if (params.items) {
            for (const item of params.items) {
                subscription.items.data.push(
                    createItem(item, subscription)
                )
            }
        }

        accountSubscriptions.put(accountId, subscription);
        customers.addSubscription(
            accountId,
            typeof subscription.customer === 'string' ?
                subscription.customer : subscription.customer.id,
            subscription
        )

        return subscription
    }

    function createPlanObj(planName: string): stripe.plans.IPlan {
        const plan: stripe.plans.IPlan = {
            id: planName,
            object: 'plan',
            active: true,
            aggregate_usage: null,
            amount: 10 * 100,
            billing_scheme: 'per_unit',
            created: Math.floor(FILE_START / 1000),
            currency: 'usd',
            interval: 'month',
            interval_count: 1,
            livemode: false,
            metadata: {},
            nickname: null,
            product: `prod_${planName.substr(5)}`,
            tiers: null,
            tiers_mode: null,
            transform_usage: null,
            trial_period_days: null,
            usage_type: 'licensed'
        }

        return plan
    }

    export function createItem(
        item: stripe.subscriptions.ISubscriptionCreationItem,
        subscription: stripe.subscriptions.ISubscription
    ): stripe.subscriptionItems.ISubscriptionItem {
        const paramId = (item as any).id
        const subItemId = paramId || `si_${generateId(14)}`

        const subscriptionItem: stripe.subscriptionItems.ISubscriptionItem = {
            object: 'subscription_item',
            id: subItemId,
            billing_thresholds: null,
            created: Math.floor(Date.now() / 1000),
            metadata: stringifyMetadata(item.metadata),
            plan: createPlanObj(item.plan),
            subscription: subscription.id
        }

        return subscriptionItem
    }

    export function update(
        accountId: string, subscriptionId: string, params: stripe.subscriptions.ISubscriptionUpdateOptions
    ): stripe.subscriptions.ISubscription {
        log.debug("subscriptions.update", accountId, subscriptionId, params);

        const subscription = retrieve(accountId, subscriptionId, "id");

        if (params.items) {
            for (let i = 0; i < params.items.length; i++) {
                subscription.items.data[i].quantity =
                    params.items[i].quantity
            }
        }

        return subscription;
    }

    export function retrieve(
        accountId: string,
        subscriptionId: string,
        paramName: string
    ): stripe.subscriptions.ISubscription {
        log.debug("subscriptions.retrieve")

        const subscription = accountSubscriptions.get(
            accountId, subscriptionId
        );
        if (!subscription) {
            throw new StripeError(404, {
                code: "resource_missing",
                doc_url: "https://stripe.com/docs/error-codes/resource-missing",
                message: `No such subscription: ${subscriptionId}`,
                param: paramName,
                type: "invalid_request_error"
            })
        }
        return subscription;
    }

    export function list(
        accountId: string,
        params: stripe.subscriptions.ISubscriptionListOptions
    ): stripe.IList<stripe.subscriptions.ISubscription> {
        let data = accountSubscriptions.getAll(accountId)
        if (params.customer) {
            data = data.filter(d => {
                if (typeof d.customer === 'string') {
                    return d.customer === params.customer
                } else {
                    return d.customer.id === params.customer
                }
            })
        }

        return applyListOptions(data, params, (id, paramName) => {
            return retrieve(accountId, id, paramName)
        })
    }

    /**
     * TODO: export function update()
     */
}
