"use client";

export interface Subscription {
  status: string;
  [key: string]: unknown;
}

export interface SubscriptionSectionProps {
  t: (key: string, values?: Record<string, string | number>) => string;
  loadingSub?: boolean;
  sub?: Subscription;
  getStatusChipStyle?: (status: string) => string;
  renderStatusLabel?: (status: string) => string;
}

export default function SubscriptionSection({
  t,
  loadingSub = false,
  sub,
  getStatusChipStyle,
  renderStatusLabel,
}: SubscriptionSectionProps) {
  return (
    <section className="border rounded-lg p-6">
      <h2 className="text-xl font-semibold mb-4">
        {t("subscription.sectionTitle")}
      </h2>
      {loadingSub && <p>{t("subscription.loading")}</p>}
      {!loadingSub && sub && (
        <div>
          <span className={getStatusChipStyle?.(sub.status)}>
            {renderStatusLabel?.(sub.status)}
          </span>
        </div>
      )}
    </section>
  );
}
