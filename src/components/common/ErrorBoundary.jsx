import { Component } from "react";
import { AlertTriangle, RefreshCw } from "../icons/Icons.jsx";
import { Button } from "./Button.jsx";
import { Card } from "./Card.jsx";

export class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null, errorInfo: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.error("Uncaught error caught by ErrorBoundary:", error, errorInfo);
    this.setState({ errorInfo });
  }

  handleReset = () => {
    this.setState({ hasError: false, error: null, errorInfo: null });
    window.location.reload();
  };

  render() {
    if (this.state.hasError) {
      return (
        <div
          style={{
            minHeight: "100vh",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: "24px",
            background: "var(--bg)",
          }}
        >
          <Card
            style={{
              maxWidth: "520px",
              width: "100%",
              padding: "32px",
              textAlign: "center",
              boxShadow: "var(--shadow-lg)",
            }}
          >
            <div
              style={{
                width: 56,
                height: 56,
                borderRadius: "50%",
                background: "var(--danger-light)",
                color: "var(--danger)",
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "center",
                marginBottom: 16,
              }}
            >
              <AlertTriangle size={28} />
            </div>

            <h2
              style={{
                fontFamily: "var(--font-heading)",
                fontSize: "22px",
                fontWeight: 800,
                marginBottom: "8px",
                color: "var(--text)",
              }}
            >
              Something Went Wrong
            </h2>

            <p
              className="fc-muted"
              style={{ fontSize: "14px", lineHeight: 1.5, marginBottom: "20px" }}
            >
              An unexpected render error occurred in this view. Don't worry, your data is safe and saved.
            </p>

            {this.state.error && (
              <pre
                style={{
                  background: "var(--bg-soft)",
                  padding: "12px",
                  borderRadius: "var(--radius-sm)",
                  fontSize: "11.5px",
                  textAlign: "left",
                  overflowX: "auto",
                  color: "var(--danger)",
                  marginBottom: "24px",
                  maxHeight: "140px",
                }}
              >
                {this.state.error.toString()}
              </pre>
            )}

            <Button variant="primary" full onClick={this.handleReset} style={{ fontWeight: 700 }}>
              <RefreshCw size={15} /> Reload Application
            </Button>
          </Card>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;
