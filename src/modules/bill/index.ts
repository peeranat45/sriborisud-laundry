/**
 * modules/bill/index.ts
 * ------------------------------------------------------------------
 * ประตูบานเดียวของ module นี้ · export เฉพาะ action กับ type
 * เหตุผลเดียวกับ modules/customer/index.ts
 */
export { listBillLinksAction } from "./actions";
export type { BillLink } from "./service";
