"use client";

import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";

export interface Subscription {
  status: string;
  plan?: string;
  renovacion?: string;
  [key: string]: unknown;
}

export interface SubscriptionSectionProps {
  t: (key: string, values?: Record<string, string | number>) => string;
  loadingSub?: boolean;
  sub?: Subscription;
}

export default function SubscriptionSection({
  t,
  loadingSub = false,
  sub,
}: SubscriptionSectionProps) {
  const getStatusStyle = (status: string) => {
    switch (status) {
      case "active":
        return "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200";
      case "trialing":
        return "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200";
      case "incomplete":
        return "bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200";
      case "canceled":
      case "no_active":
        return "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200";
      default:
        return "bg-gray-200 text-gray-700 dark:bg-gray-700 dark:text-gray-300";
    }
  };

  const renderStatusLabel = (status: string) => {
    switch (status) {
      case "active":
        return t("subscription.status.active");
      case "trialing":
        return t("subscription.status.trialing");
      case "incomplete":
        return t("subscription.status.incomplete");
      case "canceled":
        return t("subscription.status.canceled");
      case "no_active":
        return t("subscription.status.none");
      default:
        return t("subscription.status.unknown");
    }
  };

  return (
    <Card className="p-6 shadow-sm bg-card text-card-foreground">
      <h2 className="text-xl font-semibold mb-4">
        {t("subscription.sectionTitle")}
      </h2>

      {loadingSub && (
        <div className="space-y-3">
          <Skeleton className="h-6 w-32" />
          <Skeleton className="h-4 w-40" />
          <Skeleton className="h-4 w-28" />
        </div>
      )}

      {!loadingSub && sub && (
        <div className="space-y-3">
          {/* Estado */}
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium">
              {t("subscription.labels.status")}
            </span>
            <Badge className={getStatusStyle(sub.status)}>
              {renderStatusLabel(sub.status)}
            </Badge>
          </div>

          {/* Plan */}
          <p className="text-sm">
            <span className="font-medium">{t("subscription.labels.plan")}: </span>
            {sub.plan || t("subscription.labels.unknown")}
          </p>

          {/* Renovación */}
          <p className="text-sm">
            <span className="font-medium">{t("subscription.labels.renewal")}: </span>
            {sub.renovacion || t("subscription.labels.unknown")}
          </p>

          {/* Portal de Stripe */}
          <div className="pt-3">
            <Button
              variant="outline"
              className="w-full"
              onClick={() =>
                window.open(
                  "https://billing.stripe.com/p/login/aFadR981S6441s57tE4ko00",
                  "_blank"
                )
              }
            >
              {t("subscription.actions.manage")}
            </Button>
          </div>
        </div>
      )}
    </Card>
  );
}

