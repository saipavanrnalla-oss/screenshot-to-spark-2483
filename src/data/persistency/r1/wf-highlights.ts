/** The few steps to point at when walking someone through a large journey, with what each one solves. */
export interface Highlight {
  nodeId: string;
  title: string;
  text: string;
}

export const WF_HIGHLIGHTS: Record<string, Highlight[]> = {
  R1: [
    { nodeId: "band", title: "Your propensity bands drive the journey", text: "P1 to P5 get an early service call at T-90. P6 to P10 start on WhatsApp. The bands come from your analytics team; the workflow acts on them." },
    { nodeId: "call15", title: "The script changes with the band", text: "One voice agent, with different approved words for P1 to P3, P4 to P5 and P6 to P10, in the customer's language. Marketing, compliance and legal sign each version once." },
    { nodeId: "rdec", title: "The reason decides the next step", text: "The classifier reads every call. Mis-selling goes to the complaint desk, money trouble gets payment options, a service issue becomes a ticket." },
    { nodeId: "lp1", title: "Calls and WhatsApp on one platform", text: "WhatsApp with the link first, a second nudge on the same channel after two days, and a call only if the premium is still unpaid." },
    { nodeId: "worth", title: "Knows when to stop spending", text: "The Worth Pursuing Model rescores after every contact. Below 25%, in-house calls stop and the case goes to the vendor who is paid only on recovery." },
    { nodeId: "rein", title: "Revival checked before money is taken", text: "Dues, interest and the health declaration are checked before payment is accepted, so premiums stop landing in suspense and being refunded." },
  ],
  R8: [
    { nodeId: "seg", title: "Last year's payment behaviour picks the path", text: "On time, late, very late or bounced: each segment starts at a different point with its own script." },
    { nodeId: "s4mand", title: "The mandate is fixed before it bounces", text: "Customers whose auto-debit failed last year get a re-registration link at T-60, ahead of the next debit." },
    { nodeId: "lp1", title: "Calls and WhatsApp on one platform", text: "WhatsApp with the link first, a second nudge on the same channel after two days, and a call only if the premium is still unpaid." },
    { nodeId: "rpu", title: "Reduced paid-up explained in time", text: "Traditional plans that miss the 25th-month premium get a call on what the policy is worth now and how to restart it." },
    { nodeId: "worth", title: "Knows when to stop spending", text: "The Worth Pursuing Model rescores after every contact. Below 25%, in-house calls stop and the case goes to the vendor who is paid only on recovery." },
    { nodeId: "rein", title: "Revival checked before money is taken", text: "Dues, interest and the health declaration are checked before payment is accepted, so premiums stop landing in suspense and being refunded." },
  ],
};
