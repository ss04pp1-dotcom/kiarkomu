import { Feather, MaterialIcons } from "@expo/vector-icons";
import {
  useListAddresses,
  useCreateAddress,
  useUpdateAddress,
  useDeleteAddress,
  useListShippingZones,
  getListAddressesQueryKey,
  getListShippingZonesQueryKey,
} from "@workspace/api-client-react";
import { useRouter } from "expo-router";
import React, { useState, useEffect } from "react";
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/contexts/AuthContext";
import { useAlert } from "@/contexts/AlertContext";
import CustomAlert from "@/components/CustomAlert";

const PINK = "#E91E63";
const BLUE = "#1565C0";

interface AddressForm {
  label: string;
  fullName: string;
  phone: string;
  addressLine: string;
  district: string;
  area: string;
  postalCode: string;
  isDefault: boolean;
}

const EMPTY_FORM: AddressForm = {
  label: "Home",
  fullName: "",
  phone: "",
  addressLine: "",
  district: "",
  area: "",
  postalCode: "",
  isDefault: false,
};

function FormField({
  label,
  value,
  onChange,
  placeholder,
  keyboardType,
  required,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  keyboardType?: any;
  required?: boolean;
}) {
  return (
    <View style={form.fieldWrap}>
      <Text style={form.label}>
        {label}
        {required && <Text style={{ color: PINK }}> *</Text>}
      </Text>
      <TextInput
        style={form.input}
        value={value}
        onChangeText={onChange}
        placeholder={placeholder ?? label}
        placeholderTextColor="#BDBDBD"
        keyboardType={keyboardType ?? "default"}
        autoCapitalize="none"
      />
    </View>
  );
}

function AddressModal({
  visible,
  onClose,
  editAddress,
}: {
  visible: boolean;
  onClose: () => void;
  editAddress?: any;
}) {
  const qc = useQueryClient();
  const createAddr = useCreateAddress();
  const updateAddr = useUpdateAddress();

  const { data: zonesData, isLoading: zonesLoading } = useListShippingZones({
    query: { queryKey: getListShippingZonesQueryKey() },
  });
  const zones = Array.isArray(zonesData) ? zonesData : [];
  const zoneNames = zones.map((z) => z.name);

  const [f, setF] = useState<AddressForm>(
    editAddress
      ? {
          label: editAddress.label ?? "Home",
          fullName: editAddress.fullName ?? "",
          phone: editAddress.phone ?? "",
          addressLine: editAddress.addressLine ?? "",
          district: editAddress.district ?? "",
          area: editAddress.area ?? "",
          postalCode: editAddress.postalCode ?? "",
          isDefault: editAddress.isDefault ?? false,
        }
      : EMPTY_FORM
  );

  useEffect(() => {
    if (visible) {
      setF(
        editAddress
          ? {
              label: editAddress.label ?? "Home",
              fullName: editAddress.fullName ?? "",
              phone: editAddress.phone ?? "",
              addressLine: editAddress.addressLine ?? "",
              district: editAddress.district ?? "",
              area: editAddress.area ?? "",
              postalCode: editAddress.postalCode ?? "",
              isDefault: editAddress.isDefault ?? false,
            }
          : EMPTY_FORM
      );
    }
  }, [visible, editAddress]);

  useEffect(() => {
    if (zoneNames.length > 0 && !f.district) {
      setF((prev) => ({ ...prev, district: zoneNames[0] }));
    }
  }, [zoneNames.length, f.district]);

  const set = (k: keyof AddressForm) => (v: any) =>
    setF((prev) => ({ ...prev, [k]: v }));

  const isPending = createAddr.isPending || updateAddr.isPending;

  const [localAlert, setLocalAlert] = useState<{ visible: boolean; title: string; message: string }>({ visible: false, title: "", message: "" });
  const showLocalAlert = (title: string, message: string) =>
    setLocalAlert({ visible: true, title, message });

  const handleSave = () => {
    if (!f.fullName.trim() || !f.phone.trim() || !f.addressLine.trim()) {
      showLocalAlert("Missing fields", "Name, phone and address are required.");
      return;
    }
    const payload = {
      label: f.label,
      fullName: f.fullName.trim(),
      phone: f.phone.trim(),
      addressLine: f.addressLine.trim(),
      district: f.district,
      area: f.area.trim(),
      postalCode: f.postalCode.trim() || undefined,
      isDefault: f.isDefault,
    };
    const onSuccess = () => {
      qc.invalidateQueries({ queryKey: ["/api/addresses"] });
      onClose();
    };
    if (editAddress) {
      updateAddr.mutate(
        { id: editAddress.id, data: payload },
        { onSuccess }
      );
    } else {
      createAddr.mutate({ data: payload }, { onSuccess });
    }
  };

  const LABEL_OPTIONS = ["Home", "Work", "Parents", "Other"];

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <View style={form.sheetHeader}>
          <Pressable onPress={onClose} style={form.closeBtn}>
            <Feather name="x" size={20} color="#555" />
          </Pressable>
          <Text style={form.sheetTitle}>
            {editAddress ? "Edit Address" : "New Address"}
          </Text>
          <Pressable
            style={[form.saveBtn, isPending && { opacity: 0.6 }]}
            onPress={handleSave}
            disabled={isPending}
          >
            {isPending ? (
              <ActivityIndicator size="small" color="#fff" />
            ) : (
              <Text style={form.saveBtnText}>Save</Text>
            )}
          </Pressable>
        </View>

        <ScrollView
          style={{ flex: 1, backgroundColor: "#F5F5F5" }}
          contentContainerStyle={{ padding: 16, gap: 0, paddingBottom: 40 }}
          keyboardShouldPersistTaps="handled"
        >
          {/* Label picker */}
          <View style={form.fieldWrap}>
            <Text style={form.label}>Label</Text>
            <View style={form.labelRow}>
              {LABEL_OPTIONS.map((lb) => (
                <Pressable
                  key={lb}
                  style={[
                    form.labelChip,
                    f.label === lb && form.labelChipActive,
                  ]}
                  onPress={() => set("label")(lb)}
                >
                  <Text
                    style={[
                      form.labelChipText,
                      f.label === lb && form.labelChipTextActive,
                    ]}
                  >
                    {lb}
                  </Text>
                </Pressable>
              ))}
            </View>
          </View>

          <View style={form.card}>
            <FormField
              label="Full Name"
              value={f.fullName}
              onChange={set("fullName")}
              required
            />
            <FormField
              label="Phone"
              value={f.phone}
              onChange={set("phone")}
              keyboardType="phone-pad"
              placeholder="01XXXXXXXXX"
              required
            />
          </View>

          <View style={form.card}>
            <FormField
              label="Address"
              value={f.addressLine}
              onChange={set("addressLine")}
              placeholder="House no, road, area..."
              required
            />
            <View style={form.fieldWrap}>
              <Text style={form.label}>
                District / Zone
                <Text style={{ color: PINK }}> *</Text>
              </Text>
              {zonesLoading ? (
                <ActivityIndicator size="small" color={PINK} style={{ alignSelf: "flex-start", marginTop: 4 }} />
              ) : zoneNames.length === 0 ? (
                <Text style={{ fontSize: 12, color: "#999", marginTop: 4 }}>
                  No shipping zones configured. Contact admin.
                </Text>
              ) : (
                <View style={form.zoneGrid}>
                  {zoneNames.map((d) => (
                    <Pressable
                      key={d}
                      style={[
                        form.districtChip,
                        f.district === d && form.districtChipActive,
                      ]}
                      onPress={() => set("district")(d)}
                    >
                      <Text
                        style={[
                          form.districtChipText,
                          f.district === d && form.districtChipTextActive,
                        ]}
                      >
                        {d}
                      </Text>
                    </Pressable>
                  ))}
                </View>
              )}
            </View>
            <FormField label="Area / Thana" value={f.area} onChange={set("area")} />
            <FormField
              label="Postal Code"
              value={f.postalCode}
              onChange={set("postalCode")}
              keyboardType="number-pad"
              placeholder="e.g. 1212"
            />
          </View>

          <Pressable
            style={form.defaultRow}
            onPress={() => set("isDefault")(!f.isDefault)}
          >
            <View
              style={[
                form.checkbox,
                f.isDefault && { backgroundColor: PINK, borderColor: PINK },
              ]}
            >
              {f.isDefault && (
                <Feather name="check" size={12} color="#fff" />
              )}
            </View>
            <Text style={form.defaultText}>Set as default address</Text>
          </Pressable>
        </ScrollView>
      </KeyboardAvoidingView>
      <CustomAlert
        visible={localAlert.visible}
        title={localAlert.title}
        message={localAlert.message}
        onDismiss={() => setLocalAlert(prev => ({ ...prev, visible: false }))}
      />
    </Modal>
  );
}

export default function AddressesScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { token } = useAuth();
  const qc = useQueryClient();
  const { showConfirm } = useAlert();
  const topPad = Platform.OS === "web" ? 0 : insets.top;

  const { data: addresses, isLoading } = useListAddresses({
    query: { enabled: !!token, queryKey: getListAddressesQueryKey() },
  });
  const deleteAddr = useDeleteAddress();

  const [modalVisible, setModalVisible] = useState(false);
  const [editTarget, setEditTarget] = useState<any>(null);

  const addrList = Array.isArray(addresses) ? addresses : [];

  const handleDelete = (id: number) => {
    showConfirm(
      "Delete Address",
      "Remove this address?",
      () => deleteAddr.mutate({ id }, { onSuccess: () => qc.invalidateQueries({ queryKey: ["/api/addresses"] }) }),
      "Delete"
    );
  };

  return (
    <View style={[styles.container, { paddingTop: topPad }]}>
      {/* Header */}
      <View style={styles.header}>
        <Pressable
          style={styles.backBtn}
          onPress={() => router.back()}
        >
          <Feather name="arrow-left" size={20} color="#333" />
        </Pressable>
        <Text style={styles.headerTitle}>My Addresses</Text>
        <Pressable
          style={styles.addBtn}
          onPress={() => {
            setEditTarget(null);
            setModalVisible(true);
          }}
        >
          <Feather name="plus" size={18} color={PINK} />
          <Text style={styles.addBtnText}>Add</Text>
        </Pressable>
      </View>

      {isLoading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color={PINK} />
        </View>
      ) : addrList.length === 0 ? (
        <View style={styles.center}>
          <MaterialIcons name="location-off" size={48} color="#DDD" />
          <Text style={styles.emptyTitle}>No addresses saved</Text>
          <Text style={styles.emptySubtitle}>
            Add your first delivery address
          </Text>
          <Pressable
            style={styles.emptyBtn}
            onPress={() => {
              setEditTarget(null);
              setModalVisible(true);
            }}
          >
            <Feather name="plus" size={16} color="#fff" />
            <Text style={styles.emptyBtnText}>Add Address</Text>
          </Pressable>
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={{ padding: 16, gap: 12, paddingBottom: 40 }}
        >
          {addrList.map((addr: any) => (
            <View key={addr.id} style={styles.addrCard}>
              <View style={styles.addrTop}>
                <View style={styles.addrLabelRow}>
                  <View
                    style={[
                      styles.labelBadge,
                      { backgroundColor: addr.isDefault ? PINK : "#E3F2FD" },
                    ]}
                  >
                    <Text
                      style={[
                        styles.labelBadgeText,
                        { color: addr.isDefault ? "#fff" : BLUE },
                      ]}
                    >
                      {addr.label}
                    </Text>
                  </View>
                  {addr.isDefault && (
                    <Text style={styles.defaultTag}>● Default</Text>
                  )}
                </View>
                <View style={styles.addrActions}>
                  <Pressable
                    style={styles.actionBtn}
                    onPress={() => {
                      setEditTarget(addr);
                      setModalVisible(true);
                    }}
                  >
                    <Feather name="edit-2" size={15} color={BLUE} />
                  </Pressable>
                  <Pressable
                    style={[styles.actionBtn, { backgroundColor: "#FFF5F5" }]}
                    onPress={() => handleDelete(addr.id)}
                  >
                    <Feather name="trash-2" size={15} color="#EF4444" />
                  </Pressable>
                </View>
              </View>

              <Text style={styles.addrName}>{addr.fullName}</Text>
              <Text style={styles.addrPhone}>{addr.phone}</Text>
              <Text style={styles.addrLine} numberOfLines={2}>
                {addr.addressLine}
                {addr.area ? `, ${addr.area}` : ""}
              </Text>
              <Text style={styles.addrDistrict}>
                {addr.district}
                {addr.postalCode ? ` - ${addr.postalCode}` : ""}
              </Text>
            </View>
          ))}
        </ScrollView>
      )}

      <AddressModal
        visible={modalVisible}
        onClose={() => setModalVisible(false)}
        editAddress={editTarget}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#F5F5F5" },
  header: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#fff",
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#EEEEEE",
  },
  backBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "#F5F5F5",
    alignItems: "center",
    justifyContent: "center",
  },
  headerTitle: {
    flex: 1,
    textAlign: "center",
    fontSize: 17,
    fontFamily: "Inter_700Bold",
    color: "#1A1A1A",
  },
  addBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 20,
    borderWidth: 1.5,
    borderColor: PINK,
  },
  addBtnText: { color: PINK, fontFamily: "Inter_600SemiBold", fontSize: 13 },
  center: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
  },
  emptyTitle: { fontSize: 16, fontFamily: "Inter_600SemiBold", color: "#555" },
  emptySubtitle: { fontSize: 13, color: "#999" },
  emptyBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: PINK,
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 24,
    marginTop: 8,
  },
  emptyBtnText: { color: "#fff", fontFamily: "Inter_600SemiBold", fontSize: 14 },
  addrCard: {
    backgroundColor: "#fff",
    borderRadius: 16,
    padding: 16,
    shadowColor: "#000",
    shadowOpacity: 0.06,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
  addrTop: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: 10,
  },
  addrLabelRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  labelBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 20,
  },
  labelBadgeText: { fontSize: 12, fontFamily: "Inter_600SemiBold" },
  defaultTag: { fontSize: 11, color: PINK, fontFamily: "Inter_500Medium" },
  addrActions: { flexDirection: "row", gap: 6 },
  actionBtn: {
    width: 32,
    height: 32,
    borderRadius: 10,
    backgroundColor: "#EEF2FF",
    alignItems: "center",
    justifyContent: "center",
  },
  addrName: {
    fontSize: 15,
    fontFamily: "Inter_600SemiBold",
    color: "#1A1A1A",
    marginBottom: 2,
  },
  addrPhone: {
    fontSize: 13,
    fontFamily: "Inter_400Regular",
    color: "#555",
    marginBottom: 4,
  },
  addrLine: {
    fontSize: 13,
    fontFamily: "Inter_400Regular",
    color: "#666",
    lineHeight: 18,
  },
  addrDistrict: {
    fontSize: 12,
    fontFamily: "Inter_500Medium",
    color: BLUE,
    marginTop: 4,
  },
});

const form = StyleSheet.create({
  sheetHeader: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 14,
    backgroundColor: "#fff",
    borderBottomWidth: 1,
    borderBottomColor: "#EEEEEE",
  },
  closeBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "#F5F5F5",
    alignItems: "center",
    justifyContent: "center",
  },
  sheetTitle: {
    flex: 1,
    textAlign: "center",
    fontSize: 16,
    fontFamily: "Inter_700Bold",
    color: "#1A1A1A",
  },
  saveBtn: {
    backgroundColor: PINK,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    minWidth: 60,
    alignItems: "center",
  },
  saveBtnText: { color: "#fff", fontFamily: "Inter_600SemiBold", fontSize: 14 },
  card: {
    backgroundColor: "#fff",
    borderRadius: 14,
    padding: 12,
    marginBottom: 12,
  },
  fieldWrap: { marginBottom: 10 },
  label: {
    fontSize: 12,
    fontFamily: "Inter_600SemiBold",
    color: "#555",
    marginBottom: 6,
    textTransform: "uppercase",
    letterSpacing: 0.4,
  },
  input: {
    borderWidth: 1,
    borderColor: "#E0E0E0",
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
    fontFamily: "Inter_400Regular",
    color: "#1A1A1A",
    backgroundColor: "#FAFAFA",
  },
  labelRow: { flexDirection: "row", gap: 8, flexWrap: "wrap", marginBottom: 12 },
  labelChip: {
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 20,
    backgroundColor: "#F5F5F5",
    borderWidth: 1.5,
    borderColor: "#E0E0E0",
  },
  labelChipActive: { backgroundColor: "#FFF0F5", borderColor: PINK },
  labelChipText: { fontSize: 13, fontFamily: "Inter_500Medium", color: "#555" },
  labelChipTextActive: { color: PINK, fontFamily: "Inter_600SemiBold" },
  zoneGrid: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  districtChip: {
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 16,
    backgroundColor: "#F5F5F5",
    borderWidth: 1.5,
    borderColor: "#E0E0E0",
  },
  districtChipActive: { backgroundColor: "#E3F2FD", borderColor: BLUE },
  districtChipText: { fontSize: 12, fontFamily: "Inter_400Regular", color: "#555" },
  districtChipTextActive: { color: BLUE, fontFamily: "Inter_600SemiBold" },
  defaultRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    backgroundColor: "#fff",
    borderRadius: 12,
    padding: 14,
    marginBottom: 12,
  },
  checkbox: {
    width: 20,
    height: 20,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: "#CCC",
    alignItems: "center",
    justifyContent: "center",
  },
  defaultText: { fontSize: 14, fontFamily: "Inter_500Medium", color: "#333" },
});
