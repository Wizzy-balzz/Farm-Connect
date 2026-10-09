import { memo } from "react";

function SkeletonBase({ height = 16, width = "100%", radius = 8, style = {} }) {
  return <div className="fc-skeleton" style={{ height, width, borderRadius: radius, ...style }} />;
}
export const Skeleton = memo(SkeletonBase);

export const ProductCardSkeleton = memo(function ProductCardSkeleton() {
  return (
    <div className="fc-card" style={{ overflow: "hidden" }}>
      <Skeleton height={120} radius={0} />
      <div style={{ padding: 15 }}>
        <Skeleton height={11} width="40%" style={{ marginBottom: 10 }} />
        <Skeleton height={15} width="85%" style={{ marginBottom: 8 }} />
        <Skeleton height={11} width="60%" style={{ marginBottom: 14 }} />
        <Skeleton height={32} width="100%" />
      </div>
    </div>
  );
});

export const TableRowSkeleton = memo(function TableRowSkeleton({ cols = 5 }) {
  return (
    <tr>
      {Array.from({ length: cols }).map((_, i) => (
        <td key={i}>
          <Skeleton height={14} width={i === 0 ? "70%" : "90%"} />
        </td>
      ))}
    </tr>
  );
});

export const RowSkeleton = memo(function RowSkeleton() {
  return (
    <div className="fc-flex-gap-12" style={{ padding: "12px 0" }}>
      <Skeleton height={44} width={44} radius={10} />
      <div style={{ flex: 1 }}>
        <Skeleton height={12} width="50%" style={{ marginBottom: 8 }} />
        <Skeleton height={10} width="30%" />
      </div>
    </div>
  );
});

export default Skeleton;

