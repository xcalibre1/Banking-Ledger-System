type AlertVariant = "error" | "success";

interface AlertProps {
  variant: AlertVariant;
  message: string;
}

export function Alert({ variant, message }: AlertProps) {
  return (
    <div className={`alert alert-${variant}`} role="alert">
      {message}
    </div>
  );
}
