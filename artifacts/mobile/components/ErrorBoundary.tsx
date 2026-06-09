import React, { Component, ComponentType, PropsWithChildren } from "react";
import { View, Text, ScrollView, TouchableOpacity } from "react-native";
import { ErrorFallback, ErrorFallbackProps } from "@/components/ErrorFallback";

export type ErrorBoundaryProps = PropsWithChildren<{
  FallbackComponent?: ComponentType<ErrorFallbackProps>;
  onError?: (error: Error, stackTrace: string) => void;
}>;

type ErrorBoundaryState = { error: Error | null };

export class ErrorBoundary extends Component<
  ErrorBoundaryProps,
  ErrorBoundaryState
> {
  state: ErrorBoundaryState = { error: null };

  static defaultProps: {
    FallbackComponent: ComponentType<ErrorFallbackProps>;
  } = {
    FallbackComponent: ErrorFallback,
  };

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { error };
  }

  componentDidCatch(error: Error, info: { componentStack: string }): void {
    if (typeof this.props.onError === "function") {
      this.props.onError(error, info.componentStack);
    }
  }

  resetError = (): void => {
    this.setState({ error: null });
  };

  render() {
    if (this.state.error) {
      return (
        <View style={{ flex: 1, backgroundColor: "#fff", padding: 40, justifyContent: "center" }}>
          <Text style={{ fontSize: 22, fontWeight: "bold", color: "#e91e63", marginBottom: 10 }}>
            Debug: Actual Error Found
          </Text>
          <ScrollView style={{ backgroundColor: "#f5f5f5", padding: 15, borderRadius: 10, maxHeight: 400 }}>
            <Text style={{ color: "#333", fontSize: 16, fontWeight: "600" }}>
              Message: {this.state.error.message}
            </Text>
            <Text style={{ color: "#666", fontSize: 12, marginTop: 10 }}>
              Stack: {this.state.error.stack}
            </Text>
          </ScrollView>
          <TouchableOpacity 
            onPress={this.resetError}
            style={{ marginTop: 20, backgroundColor: "#e91e63", padding: 15, borderRadius: 8, alignItems: "center" }}
          >
            <Text style={{ color: "#fff", fontWeight: "bold" }}>Try Again</Text>
          </TouchableOpacity>
        </View>
      );
    }

    return this.props.children;
  }
}