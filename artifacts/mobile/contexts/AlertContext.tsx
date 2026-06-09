import React, { createContext, useContext, useState } from 'react';
import { Modal, View, Text, TouchableOpacity, StyleSheet, Dimensions } from 'react-native';

interface AlertOptions {
  title: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  onConfirm?: () => void;
  showCancel?: boolean;
}

interface AlertContextType {
  showAlert: (titleOrOptions: string | { title: string; message: string }, message?: string) => void;
  showConfirm: (titleOrOptions: string | { title: string; message: string }, messageOrOnConfirm?: string | (() => void), onConfirm?: () => void, confirmText?: string) => void;
}

const AlertContext = createContext<AlertContextType | undefined>(undefined);
const { width } = Dimensions.get('window');

export const AlertProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [visible, setVisible] = useState(false);
  const [config, setConfig] = useState<AlertOptions>({
    title: "",
    message: "",
  });

  const showAlert = (titleOrOptions: string | { title: string; message: string }, message?: string) => {
    if (typeof titleOrOptions === 'object' && titleOrOptions !== null) {
      setConfig({
        title: titleOrOptions.title,
        message: titleOrOptions.message,
        confirmText: "OK",
        showCancel: false,
      });
    } else {
      setConfig({
        title: titleOrOptions,
        message: message || "",
        confirmText: "OK",
        showCancel: false,
      });
    }
    setVisible(true);
  };

  const showConfirm = (
    titleOrOptions: string | { title: string; message: string },
    messageOrOnConfirm?: string | (() => void),
    onConfirm?: () => void,
    confirmText = "Confirm"
  ) => {
    let title = "";
    let message = "";
    let finalOnConfirm: (() => void) | undefined = onConfirm;

    if (typeof titleOrOptions === 'object' && titleOrOptions !== null) {
      title = titleOrOptions.title;
      message = titleOrOptions.message;
      finalOnConfirm = messageOrOnConfirm as () => void;
    } else {
      title = titleOrOptions;
      message = messageOrOnConfirm as string;
    }

    setConfig({
      title,
      message,
      confirmText,
      cancelText: "Cancel",
      onConfirm: () => {
        setVisible(false);
        if (finalOnConfirm) finalOnConfirm();
      },
      showCancel: true,
    });
    setVisible(true);
  };

  return (
    <AlertContext.Provider value={{ showAlert, showConfirm }}>
      {children}
      <Modal transparent visible={visible} animationType="fade" onRequestClose={() => setVisible(false)}>
        <View style={styles.overlay}>
          <View style={styles.alertBox}>
            <View style={styles.iconContainer}>
              <Text style={styles.iconText}>📢</Text>
            </View>
            <Text style={styles.title}>{config.title}</Text>
            <Text style={styles.message}>{config.message}</Text>
            
            <View style={styles.buttonContainer}>
              {config.showCancel && (
                <TouchableOpacity 
                  style={[styles.button, styles.cancelButton]} 
                  onPress={() => setVisible(false)}
                >
                  <Text style={styles.cancelButtonText}>{config.cancelText || "Cancel"}</Text>
                </TouchableOpacity>
              )}
              <TouchableOpacity 
                style={[styles.button, config.showCancel ? styles.halfButton : styles.fullButton]} 
                onPress={config.onConfirm ? config.onConfirm : () => setVisible(false)}
              >
                <Text style={styles.buttonText}>{config.confirmText || "OK"}</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </AlertContext.Provider>
  );
};

export const useAlert = () => {
  const context = useContext(AlertContext);
  if (!context) {
    throw new Error("useAlert must be used within an AlertProvider");
  }
  return context;
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  alertBox: {
    width: width * 0.85,
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    padding: 24,
    alignItems: 'center',
  },
  iconContainer: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#FFF0F5',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  iconText: {
    fontSize: 24,
  },
  title: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#1F2937',
    marginBottom: 8,
    textAlign: 'center',
  },
  message: {
    fontSize: 14,
    color: '#6B7280',
    textAlign: 'center',
    marginBottom: 24,
    lineHeight: 20,
  },
  buttonContainer: {
    flexDirection: 'row',
    width: '100%',
    justifyContent: 'space-between',
  },
  button: {
    height: 48,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
  },
  fullButton: {
    width: '100%',
    backgroundColor: '#E91E63',
  },
  halfButton: {
    width: '48%',
    backgroundColor: '#E91E63',
  },
  cancelButton: {
    width: '48%',
    backgroundColor: '#F3F4F6',
  },
  buttonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: 'bold',
  },
  cancelButtonText: {
    color: '#4B5563',
    fontSize: 16,
    fontWeight: 'bold',
  },
});