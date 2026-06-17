interface CardToolbarProps {
  title: string;
  onRefresh: () => void;
  isRefreshing?: boolean;
}

export function CardToolbar({
  title,
  onRefresh,
  isRefreshing = false,
}: CardToolbarProps) {
  return (
    <div className="toolbar">
      <h2>{title}</h2>
      <button
        type="button"
        className="btn btn-secondary"
        onClick={onRefresh}
        disabled={isRefreshing}
      >
        Refresh
      </button>
    </div>
  );
}
