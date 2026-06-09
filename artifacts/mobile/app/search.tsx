import { Feather } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useListCategories, useListBrands, useListProducts, getListProductsQueryKey } from "@workspace/api-client-react";
import { useLocalSearchParams, useRouter } from "expo-router";
import React, { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { API_BASE_URL } from "@/lib/config";
import {
  ActivityIndicator,
  Animated,
  FlatList,
  Image,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

const PINK = "#E91E63";
const HISTORY_KEY = "shohure_search_history";
const MAX_HISTORY = 10;

type SortKey = "newest" | "price_asc" | "price_desc";
const SORT_OPTIONS: { key: SortKey; label: string; icon: string }[] = [
  { key: "newest", label: "Newest", icon: "clock" },
  { key: "price_asc", label: "Price ↑", icon: "trending-up" },
  { key: "price_desc", label: "Price ↓", icon: "trending-down" },
];

const PRICE_PRESETS = [
  { label: "Under ৳1,000", min: undefined, max: 1000 },
  { label: "৳1,000–5,000", min: 1000, max: 5000 },
  { label: "৳5,000–20,000", min: 5000, max: 20000 },
  { label: "৳20,000+", min: 20000, max: undefined },
];

function useDebounce<T>(value: T, delay: number) {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(t);
  }, [value, delay]);
  return debounced;
}

export default function SearchScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const params = useLocalSearchParams<{ q?: string; categoryId?: string }>();
  const inputRef = useRef<TextInput>(null);

  const [query, setQuery] = useState(params.q ?? "");
  const [history, setHistory] = useState<string[]>([]);
  const [filterVisible, setFilterVisible] = useState(false);
  const [page, setPage] = useState(1);
  const [allProducts, setAllProducts] = useState<any[]>([]);

  const [sortBy, setSortBy] = useState<SortKey>("newest");
  const [selectedCatId, setSelectedCatId] = useState<number | null>(
    params.categoryId ? parseInt(params.categoryId) : null
  );
  const [selectedBrandId, setSelectedBrandId] = useState<number | null>(null);
  const [pricePreset, setPricePreset] = useState<number | null>(null);
  const [minPrice, setMinPrice] = useState<number | undefined>();
  const [maxPrice, setMaxPrice] = useState<number | undefined>();
  const [inStockOnly, setInStockOnly] = useState(false);

  const [pendingCatId, setPendingCatId] = useState<number | null>(selectedCatId);
  const [pendingBrandId, setPendingBrandId] = useState<number | null>(selectedBrandId);
  const [pendingPricePreset, setPendingPricePreset] = useState<number | null>(pricePreset);
  const [pendingInStock, setPendingInStock] = useState(inStockOnly);

  const [suggestions, setSuggestions] = useState<Array<{ id: number; name: string; slug: string; thumbnailUrl: string | null; categoryName: string | null }>>([]);
  const [suggestionsLoading, setSuggestionsLoading] = useState(false);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [headerHeight, setHeaderHeight] = useState(65);

  const debouncedQuery = useDebounce(query, 300);
  const isSearching = debouncedQuery.trim().length > 0 || selectedCatId !== null || selectedBrandId !== null || minPrice !== undefined || maxPrice !== undefined || inStockOnly;

  useEffect(() => {
    const trimmed = debouncedQuery.trim();
    if (trimmed.length < 2) {
      setSuggestions([]);
      setShowSuggestions(false);
      return;
    }
    setSuggestionsLoading(true);
    fetch(`${API_BASE_URL}/api/products/suggestions?q=${encodeURIComponent(trimmed)}`)
      .then(r => r.ok ? r.json() : [])
      .then(data => {
        const list = Array.isArray(data) ? data : [];
        setSuggestions(list);
        setShowSuggestions(list.length > 0);
      })
      .catch(() => { setSuggestions([]); setShowSuggestions(false); })
      .finally(() => setSuggestionsLoading(false));
  }, [debouncedQuery]);

  const { data: categoriesData } = useListCategories();
  const categories = Array.isArray(categoriesData) ? categoriesData : [];
  const { data: brandsData } = useListBrands();
  const brands = Array.isArray(brandsData) ? brandsData : [];

  const { data: resultsData, isLoading, isFetching } = useListProducts({
    search: debouncedQuery.trim() || undefined,
    categoryId: selectedCatId ?? undefined,
    brandId: selectedBrandId ?? undefined,
    minPrice: minPrice,
    maxPrice: maxPrice,
    inStock: inStockOnly ? true : undefined,
    sortBy: sortBy === "newest" ? undefined : sortBy,
    limit: 20,
    page,
  } as any, { query: { enabled: isSearching, queryKey: getListProductsQueryKey({ search: debouncedQuery.trim() || undefined, categoryId: selectedCatId ?? undefined, brandId: selectedBrandId ?? undefined, minPrice, maxPrice, inStock: inStockOnly ? true : undefined, sortBy: sortBy === "newest" ? undefined : sortBy, limit: 20, page } as any) } });

  const total = (resultsData as any)?.total ?? 0;
  const totalPages = (resultsData as any)?.totalPages ?? 1;
  const pageProducts = (resultsData as any)?.products ?? [];

  useEffect(() => {
    if (page === 1) {
      setAllProducts(pageProducts);
    } else {
      setAllProducts(prev => {
        const ids = new Set(prev.map((p: any) => p.id));
        return [...prev, ...pageProducts.filter((p: any) => !ids.has(p.id))];
      });
    }
  }, [resultsData, page]);

  useEffect(() => {
    setPage(1);
    // Don't clear allProducts here — the resultsData effect will replace them
    // when new data arrives, preventing the flash of empty list during debounce
  }, [debouncedQuery, selectedCatId, selectedBrandId, minPrice, maxPrice, inStockOnly, sortBy]);

  useEffect(() => {
    AsyncStorage.getItem(HISTORY_KEY).then(val => {
      if (val) {
        try { setHistory(JSON.parse(val)); } catch { /* corrupted history — ignore */ }
      }
    }).catch(() => {});
    const focusTimeout = setTimeout(() => inputRef.current?.focus(), 100);
    return () => clearTimeout(focusTimeout);
  }, []);

  const saveToHistory = useCallback(async (q: string) => {
    const trimmed = q.trim();
    if (!trimmed) return;
    const updated = [trimmed, ...history.filter(h => h !== trimmed)].slice(0, MAX_HISTORY);
    setHistory(updated);
    await AsyncStorage.setItem(HISTORY_KEY, JSON.stringify(updated));
  }, [history]);

  const removeFromHistory = useCallback(async (q: string) => {
    const updated = history.filter(h => h !== q);
    setHistory(updated);
    await AsyncStorage.setItem(HISTORY_KEY, JSON.stringify(updated));
  }, [history]);

  const clearHistory = useCallback(async () => {
    setHistory([]);
    await AsyncStorage.removeItem(HISTORY_KEY);
  }, []);

  const applyHistory = (q: string) => {
    setQuery(q);
    saveToHistory(q);
  };

  const handleSubmit = () => {
    if (query.trim()) saveToHistory(query.trim());
    setShowSuggestions(false);
  };

  const handleSuggestionTap = (item: { id: number; name: string }) => {
    setShowSuggestions(false);
    setSuggestions([]);
    setQuery("");
    router.push(`/product/${item.id}` as any);
  };

  const openFilter = () => {
    setPendingCatId(selectedCatId);
    setPendingBrandId(selectedBrandId);
    setPendingPricePreset(pricePreset);
    setPendingInStock(inStockOnly);
    setFilterVisible(true);
  };

  const applyFilters = () => {
    setSelectedCatId(pendingCatId);
    setSelectedBrandId(pendingBrandId);
    setPricePreset(pendingPricePreset);
    setInStockOnly(pendingInStock);
    if (pendingPricePreset !== null) {
      setMinPrice(PRICE_PRESETS[pendingPricePreset].min);
      setMaxPrice(PRICE_PRESETS[pendingPricePreset].max);
    } else {
      setMinPrice(undefined);
      setMaxPrice(undefined);
    }
    setFilterVisible(false);
  };

  const resetFilters = () => {
    setPendingCatId(null);
    setPendingBrandId(null);
    setPendingPricePreset(null);
    setPendingInStock(false);
  };

  const activeFilterCount = useMemo(() => {
    let n = 0;
    if (selectedCatId) n++;
    if (selectedBrandId) n++;
    if (pricePreset !== null) n++;
    if (inStockOnly) n++;
    return n;
  }, [selectedCatId, selectedBrandId, pricePreset, inStockOnly]);

  const selectedCatName = categories.find((c: any) => c.id === selectedCatId)?.name;
  const selectedBrandName = brands.find((b: any) => b.id === selectedBrandId)?.name;

  const topPad = Platform.OS === "web" ? 0 : insets.top;

  const renderProduct = ({ item }: { item: any }) => (
    <Pressable
      style={styles.productCard}
      onPress={() => router.push(`/product/${item.id}` as any)}
    >
      <Image
        source={{ uri: item.thumbnailUrl }}
        style={styles.productImage}
        resizeMode="cover"
      />
      {item.discountPercent ? (
        <View style={styles.discountBadge}>
          <Text style={styles.discountText}>-{item.discountPercent}%</Text>
        </View>
      ) : null}
      {item.isFast ? (
        <View style={styles.fastBadge}>
          <Text style={styles.fastText}>⚡</Text>
        </View>
      ) : null}
      <View style={styles.productInfo}>
        <Text style={styles.productName} numberOfLines={2}>{item.name}</Text>
        {item.avgRating ? (
          <View style={styles.ratingRow}>
            <Feather name="star" size={10} color="#FFC107" />
            <Text style={styles.ratingText}>{Number(item.avgRating).toFixed(1)}</Text>
            <Text style={styles.reviewCount}>({item.reviewCount})</Text>
          </View>
        ) : null}
        <View style={styles.priceRow}>
          <Text style={styles.price}>৳{Number(item.price).toLocaleString()}</Text>
          {item.originalPrice ? (
            <Text style={styles.originalPrice}>৳{Number(item.originalPrice).toLocaleString()}</Text>
          ) : null}
        </View>
        {item.stock <= 5 && item.stock > 0 ? (
          <Text style={styles.lowStock}>Only {item.stock} left!</Text>
        ) : null}
      </View>
    </Pressable>
  );

  return (
    <View style={[styles.root, { paddingTop: topPad }]}>
      {/* Search header + suggestions dropdown */}
      <View style={styles.headerWrapper}>
        <View style={styles.header} onLayout={e => setHeaderHeight(e.nativeEvent.layout.height)}>
          <Pressable style={styles.backBtn} onPress={() => router.back()}>
            <Feather name="arrow-left" size={22} color="#1A1A1A" />
          </Pressable>
          <View style={styles.searchBar}>
            <Feather name="search" size={16} color="#999" />
            <TextInput
              ref={inputRef}
              style={styles.searchInput}
              placeholder="Search products, brands..."
              placeholderTextColor="#999"
              value={query}
              onChangeText={setQuery}
              returnKeyType="search"
              onSubmitEditing={handleSubmit}
              autoCorrect={false}
            />
            {query.length > 0 ? (
              <Pressable onPress={() => { setQuery(""); setSuggestions([]); setShowSuggestions(false); }} style={styles.clearBtn}>
                <Feather name="x-circle" size={16} color="#999" />
              </Pressable>
            ) : null}
          </View>
        </View>

        {/* Autocomplete suggestions dropdown */}
        {showSuggestions && suggestions.length > 0 ? (
          <View style={[styles.suggestionsDropdown, { top: headerHeight }]}>
            {suggestionsLoading ? (
              <View style={styles.suggestionLoading}>
                <ActivityIndicator size="small" color={PINK} />
              </View>
            ) : (
              suggestions.slice(0, 10).map((item, index) => (
                <Pressable
                  key={item.id}
                  style={[styles.suggestionItem, index > 0 && styles.suggestionItemBorder]}
                  onPress={() => handleSuggestionTap(item)}
                >
                  {item.thumbnailUrl ? (
                    <Image source={{ uri: item.thumbnailUrl }} style={styles.suggestionThumb} resizeMode="cover" />
                  ) : (
                    <View style={[styles.suggestionThumb, styles.suggestionThumbPlaceholder]}>
                      <Feather name="image" size={14} color="#ccc" />
                    </View>
                  )}
                  <View style={styles.suggestionTextWrap}>
                    <Text style={styles.suggestionName} numberOfLines={1}>{item.name}</Text>
                    {item.categoryName ? (
                      <Text style={styles.suggestionCat} numberOfLines={1}>{item.categoryName}</Text>
                    ) : null}
                  </View>
                  <Feather name="arrow-up-left" size={14} color="#ccc" />
                </Pressable>
              ))
            )}
          </View>
        ) : null}
      </View>

      {/* Sort + Filter bar — shown when actively searching */}
      {isSearching ? (
        <View style={styles.controlBar}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.sortScroll}>
            {SORT_OPTIONS.map(opt => (
              <Pressable
                key={opt.key}
                style={[styles.sortChip, sortBy === opt.key && styles.sortChipActive]}
                onPress={() => setSortBy(opt.key)}
              >
                <Feather name={opt.icon as any} size={12} color={sortBy === opt.key ? "#fff" : "#555"} />
                <Text style={[styles.sortChipText, sortBy === opt.key && styles.sortChipTextActive]}>{opt.label}</Text>
              </Pressable>
            ))}
          </ScrollView>
          <Pressable style={styles.filterBtn} onPress={openFilter}>
            <Feather name="sliders" size={14} color={activeFilterCount > 0 ? PINK : "#555"} />
            <Text style={[styles.filterBtnText, activeFilterCount > 0 && { color: PINK }]}>Filter</Text>
            {activeFilterCount > 0 ? (
              <View style={styles.filterBadge}>
                <Text style={styles.filterBadgeText}>{activeFilterCount}</Text>
              </View>
            ) : null}
          </Pressable>
        </View>
      ) : null}

      {/* Active filter chips */}
      {(selectedCatName || selectedBrandName || pricePreset !== null || inStockOnly) ? (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chipsRow} contentContainerStyle={{ gap: 6, paddingHorizontal: 12, paddingVertical: 6 }}>
          {selectedCatName ? (
            <Pressable style={styles.activeChip} onPress={() => setSelectedCatId(null)}>
              <Text style={styles.activeChipText}>{selectedCatName}</Text>
              <Feather name="x" size={11} color={PINK} />
            </Pressable>
          ) : null}
          {selectedBrandName ? (
            <Pressable style={styles.activeChip} onPress={() => setSelectedBrandId(null)}>
              <Text style={styles.activeChipText}>{selectedBrandName}</Text>
              <Feather name="x" size={11} color={PINK} />
            </Pressable>
          ) : null}
          {pricePreset !== null ? (
            <Pressable style={styles.activeChip} onPress={() => { setPricePreset(null); setMinPrice(undefined); setMaxPrice(undefined); }}>
              <Text style={styles.activeChipText}>{PRICE_PRESETS[pricePreset].label}</Text>
              <Feather name="x" size={11} color={PINK} />
            </Pressable>
          ) : null}
          {inStockOnly ? (
            <Pressable style={styles.activeChip} onPress={() => setInStockOnly(false)}>
              <Text style={styles.activeChipText}>In Stock</Text>
              <Feather name="x" size={11} color={PINK} />
            </Pressable>
          ) : null}
        </ScrollView>
      ) : null}

      {/* Main content */}
      {!isSearching ? (
        /* ── Idle state: history + trending categories ── */
        <ScrollView style={styles.idleScroll} showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 40 }}>
          {history.length > 0 ? (
            <View style={styles.section}>
              <View style={styles.sectionHeader}>
                <Text style={styles.sectionTitle}>Recent Searches</Text>
                <Pressable onPress={clearHistory}>
                  <Text style={styles.clearAll}>Clear all</Text>
                </Pressable>
              </View>
              <View style={styles.historyList}>
                {history.map((h, i) => (
                  <Pressable key={i} style={styles.historyItem} onPress={() => applyHistory(h)}>
                    <Feather name="clock" size={14} color="#999" />
                    <Text style={styles.historyText} numberOfLines={1}>{h}</Text>
                    <Pressable onPress={() => removeFromHistory(h)} style={styles.historyRemove}>
                      <Feather name="x" size={12} color="#bbb" />
                    </Pressable>
                  </Pressable>
                ))}
              </View>
            </View>
          ) : null}

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Browse Categories</Text>
            <View style={styles.categoryGrid}>
              {categories.map((c: any) => (
                <Pressable
                  key={c.id}
                  style={styles.categoryTile}
                  onPress={() => {
                    setSelectedCatId(c.id);
                    setQuery("");
                  }}
                >
                  {c.imageUrl ? (
                    <Image source={{ uri: c.imageUrl }} style={styles.categoryImg} />
                  ) : (
                    <View style={[styles.categoryImg, styles.categoryImgPlaceholder]}>
                      <Feather name="grid" size={18} color={PINK} />
                    </View>
                  )}
                  <Text style={styles.categoryTileText} numberOfLines={2}>{c.name}</Text>
                </Pressable>
              ))}
            </View>
          </View>
        </ScrollView>
      ) : (
        /* ── Search results ── */
        <View style={styles.resultsContainer}>
          {isLoading && page === 1 ? (
            <View style={styles.loadingState}>
              <ActivityIndicator size="large" color={PINK} />
              <Text style={styles.loadingText}>Searching...</Text>
            </View>
          ) : (
            <>
              {total > 0 ? (
                <View style={styles.resultsHeader}>
                  <Text style={styles.resultsCount}>
                    <Text style={{ color: PINK, fontFamily: "Inter_700Bold" }}>{total}</Text>
                    {" result"}{total !== 1 ? "s" : ""}
                    {debouncedQuery.trim() ? ` for "${debouncedQuery.trim()}"` : ""}
                  </Text>
                </View>
              ) : null}
              <FlatList
                data={allProducts}
                keyExtractor={(item: any) => String(item.id)}
                numColumns={2}
                showsVerticalScrollIndicator={false}
                contentContainerStyle={styles.productGrid}
                columnWrapperStyle={{ gap: 10 }}
                renderItem={renderProduct}
                ListEmptyComponent={
                  <View style={styles.emptyState}>
                    <Feather name="search" size={48} color="#ddd" />
                    <Text style={styles.emptyTitle}>No results found</Text>
                    <Text style={styles.emptySubtitle}>
                      {debouncedQuery.trim()
                        ? `Try a different search term or remove some filters.`
                        : "Remove some filters to see more results."}
                    </Text>
                    {activeFilterCount > 0 ? (
                      <Pressable style={styles.clearFiltersBtn} onPress={() => {
                        setSelectedCatId(null); setSelectedBrandId(null);
                        setPricePreset(null); setMinPrice(undefined); setMaxPrice(undefined);
                        setInStockOnly(false);
                      }}>
                        <Text style={styles.clearFiltersBtnText}>Clear all filters</Text>
                      </Pressable>
                    ) : null}
                  </View>
                }
                ListFooterComponent={
                  allProducts.length > 0 && page < totalPages ? (
                    <Pressable
                      style={styles.loadMoreBtn}
                      onPress={() => setPage(p => p + 1)}
                      disabled={isFetching}
                    >
                      {isFetching ? (
                        <ActivityIndicator size="small" color="#fff" />
                      ) : (
                        <Text style={styles.loadMoreText}>Load more</Text>
                      )}
                    </Pressable>
                  ) : allProducts.length > 0 && page >= totalPages ? (
                    <Text style={styles.endText}>— {total} results shown —</Text>
                  ) : null
                }
              />
            </>
          )}
        </View>
      )}

      {/* Filter bottom sheet */}
      <Modal
        visible={filterVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setFilterVisible(false)}
      >
        <Pressable style={styles.modalOverlay} onPress={() => setFilterVisible(false)} />
        <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={styles.filterSheet}>
          <View style={styles.filterHandle} />
          <View style={styles.filterHeader}>
            <Text style={styles.filterTitle}>Filter Results</Text>
            <Pressable onPress={() => setFilterVisible(false)}>
              <Feather name="x" size={20} color="#333" />
            </Pressable>
          </View>
          <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 24 }}>
            {/* Categories */}
            <View style={styles.filterSection}>
              <Text style={styles.filterSectionTitle}>Category</Text>
              <View style={styles.filterChips}>
                <Pressable
                  style={[styles.filterChip, pendingCatId === null && styles.filterChipActive]}
                  onPress={() => setPendingCatId(null)}
                >
                  <Text style={[styles.filterChipText, pendingCatId === null && styles.filterChipTextActive]}>All</Text>
                </Pressable>
                {categories.map((c: any) => (
                  <Pressable
                    key={c.id}
                    style={[styles.filterChip, pendingCatId === c.id && styles.filterChipActive]}
                    onPress={() => setPendingCatId(pendingCatId === c.id ? null : c.id)}
                  >
                    <Text style={[styles.filterChipText, pendingCatId === c.id && styles.filterChipTextActive]}>{c.name}</Text>
                  </Pressable>
                ))}
              </View>
            </View>

            {/* Brands */}
            {brands.length > 0 ? (
              <View style={styles.filterSection}>
                <Text style={styles.filterSectionTitle}>Brand</Text>
                <View style={styles.filterChips}>
                  <Pressable
                    style={[styles.filterChip, pendingBrandId === null && styles.filterChipActive]}
                    onPress={() => setPendingBrandId(null)}
                  >
                    <Text style={[styles.filterChipText, pendingBrandId === null && styles.filterChipTextActive]}>All Brands</Text>
                  </Pressable>
                  {brands.map((b: any) => (
                    <Pressable
                      key={b.id}
                      style={[styles.filterChip, pendingBrandId === b.id && styles.filterChipActive]}
                      onPress={() => setPendingBrandId(pendingBrandId === b.id ? null : b.id)}
                    >
                      <Text style={[styles.filterChipText, pendingBrandId === b.id && styles.filterChipTextActive]}>{b.name}</Text>
                    </Pressable>
                  ))}
                </View>
              </View>
            ) : null}

            {/* Price range */}
            <View style={styles.filterSection}>
              <Text style={styles.filterSectionTitle}>Price Range</Text>
              <View style={styles.filterChips}>
                <Pressable
                  style={[styles.filterChip, pendingPricePreset === null && styles.filterChipActive]}
                  onPress={() => setPendingPricePreset(null)}
                >
                  <Text style={[styles.filterChipText, pendingPricePreset === null && styles.filterChipTextActive]}>Any Price</Text>
                </Pressable>
                {PRICE_PRESETS.map((preset, i) => (
                  <Pressable
                    key={i}
                    style={[styles.filterChip, pendingPricePreset === i && styles.filterChipActive]}
                    onPress={() => setPendingPricePreset(pendingPricePreset === i ? null : i)}
                  >
                    <Text style={[styles.filterChipText, pendingPricePreset === i && styles.filterChipTextActive]}>{preset.label}</Text>
                  </Pressable>
                ))}
              </View>
            </View>

            {/* In stock */}
            <View style={styles.filterSection}>
              <Pressable style={styles.toggleRow} onPress={() => setPendingInStock(v => !v)}>
                <View>
                  <Text style={styles.filterSectionTitle}>In Stock Only</Text>
                  <Text style={styles.toggleSub}>Show only available items</Text>
                </View>
                <View style={[styles.toggle, pendingInStock && styles.toggleActive]}>
                  <View style={[styles.toggleKnob, pendingInStock && styles.toggleKnobActive]} />
                </View>
              </Pressable>
            </View>
          </ScrollView>

          {/* Actions */}
          <View style={styles.filterActions}>
            <Pressable style={styles.resetBtn} onPress={resetFilters}>
              <Text style={styles.resetBtnText}>Reset</Text>
            </Pressable>
            <Pressable style={styles.applyBtn} onPress={applyFilters}>
              <Text style={styles.applyBtnText}>Apply Filters</Text>
            </Pressable>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: "#fff" },

  /* Header wrapper — elevates above scroll content for dropdown overlay */
  headerWrapper: { zIndex: 1000, elevation: 1000 },

  /* Header */
  header: { flexDirection: "row", alignItems: "center", paddingHorizontal: 12, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: "#F0F0F0", gap: 10, backgroundColor: "#fff" },

  /* Suggestions dropdown */
  suggestionsDropdown: { position: "absolute", left: 10, right: 10, backgroundColor: "#fff", borderRadius: 12, borderWidth: 1, borderColor: "#F0F0F0", shadowColor: "#000", shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.12, shadowRadius: 14, elevation: 999, zIndex: 999, overflow: "hidden" },
  suggestionLoading: { paddingVertical: 16, alignItems: "center" },
  suggestionItem: { flexDirection: "row", alignItems: "center", gap: 10, paddingHorizontal: 12, paddingVertical: 10 },
  suggestionItemBorder: { borderTopWidth: 1, borderTopColor: "#F8F8F8" },
  suggestionThumb: { width: 36, height: 36, borderRadius: 8, backgroundColor: "#F5F5F5" },
  suggestionThumbPlaceholder: { alignItems: "center", justifyContent: "center" },
  suggestionTextWrap: { flex: 1, gap: 1 },
  suggestionName: { fontSize: 13, fontFamily: "Inter_500Medium", color: "#1A1A1A" },
  suggestionCat: { fontSize: 11, fontFamily: "Inter_400Regular", color: "#999" },
  backBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: "#F5F5F5", alignItems: "center", justifyContent: "center" },
  searchBar: { flex: 1, flexDirection: "row", alignItems: "center", backgroundColor: "#fff", borderRadius: 12, paddingHorizontal: 12, paddingVertical: 10, gap: 8, borderWidth: 1.5, borderColor: "#E91E63", shadowColor: "#E91E63", shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.08, shadowRadius: 6, elevation: 2 },
  searchInput: { flex: 1, fontSize: 16, fontFamily: "Inter_400Regular", color: "#1A1A1A" },
  clearBtn: { padding: 2 },

  /* Sort/Filter bar */
  controlBar: { flexDirection: "row", alignItems: "center", borderBottomWidth: 1, borderBottomColor: "#F0F0F0", paddingRight: 12 },
  sortScroll: { paddingHorizontal: 12, paddingVertical: 8, gap: 8 },
  sortChip: { flexDirection: "row", alignItems: "center", gap: 4, paddingHorizontal: 10, paddingVertical: 5, borderRadius: 20, backgroundColor: "#F5F5F5", borderWidth: 1, borderColor: "#E0E0E0" },
  sortChipActive: { backgroundColor: PINK, borderColor: PINK },
  sortChipText: { fontSize: 12, fontFamily: "Inter_500Medium", color: "#555" },
  sortChipTextActive: { color: "#fff" },
  filterBtn: { flexDirection: "row", alignItems: "center", gap: 4, paddingHorizontal: 10, paddingVertical: 6, borderRadius: 8, borderWidth: 1, borderColor: "#E0E0E0", marginLeft: 4, position: "relative" },
  filterBtnText: { fontSize: 12, fontFamily: "Inter_500Medium", color: "#555" },
  filterBadge: { position: "absolute", top: -5, right: -5, backgroundColor: PINK, width: 16, height: 16, borderRadius: 8, alignItems: "center", justifyContent: "center" },
  filterBadgeText: { fontSize: 9, color: "#fff", fontFamily: "Inter_700Bold" },

  /* Active filter chips */
  chipsRow: { maxHeight: 46, borderBottomWidth: 1, borderBottomColor: "#F0F0F0" },
  activeChip: { flexDirection: "row", alignItems: "center", gap: 4, paddingHorizontal: 10, paddingVertical: 4, borderRadius: 20, backgroundColor: "#FFF0F5", borderWidth: 1, borderColor: "#FFCCE0" },
  activeChipText: { fontSize: 12, fontFamily: "Inter_500Medium", color: PINK },

  /* Idle state */
  idleScroll: { flex: 1 },
  section: { paddingHorizontal: 16, paddingTop: 20 },
  sectionHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 12 },
  sectionTitle: { fontSize: 15, fontFamily: "Inter_700Bold", color: "#1A1A1A" },
  clearAll: { fontSize: 13, color: PINK, fontFamily: "Inter_500Medium" },
  historyList: { gap: 2 },
  historyItem: { flexDirection: "row", alignItems: "center", gap: 10, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: "#F5F5F5" },
  historyText: { flex: 1, fontSize: 14, fontFamily: "Inter_400Regular", color: "#333" },
  historyRemove: { padding: 4 },
  categoryGrid: { flexDirection: "row", flexWrap: "wrap", gap: 10, marginTop: 4 },
  categoryTile: { width: "30%", alignItems: "center", gap: 6, paddingVertical: 10, borderRadius: 12, backgroundColor: "#FAFAFA", borderWidth: 1, borderColor: "#F0F0F0" },
  categoryImg: { width: 44, height: 44, borderRadius: 22 },
  categoryImgPlaceholder: { backgroundColor: "#FFF0F5", alignItems: "center", justifyContent: "center" },
  categoryTileText: { fontSize: 11, fontFamily: "Inter_500Medium", color: "#333", textAlign: "center", paddingHorizontal: 4, lineHeight: 14 },

  /* Results */
  resultsContainer: { flex: 1 },
  resultsHeader: { paddingHorizontal: 14, paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: "#F5F5F5" },
  resultsCount: { fontSize: 13, fontFamily: "Inter_400Regular", color: "#666" },
  productGrid: { padding: 10, paddingBottom: 100 },
  productCard: { flex: 1, backgroundColor: "#fff", borderRadius: 12, overflow: "hidden", borderWidth: 1, borderColor: "#F0F0F0", elevation: 1, shadowColor: "#000", shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.06, shadowRadius: 4 },
  productImage: { width: "100%", height: 150 },
  discountBadge: { position: "absolute", top: 8, left: 8, backgroundColor: PINK, paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4 },
  discountText: { color: "#fff", fontSize: 10, fontFamily: "Inter_700Bold" },
  fastBadge: { position: "absolute", top: 8, right: 8, backgroundColor: "#FF9800", width: 22, height: 22, borderRadius: 11, alignItems: "center", justifyContent: "center" },
  fastText: { fontSize: 11 },
  productInfo: { padding: 8, gap: 3 },
  productName: { fontSize: 12, fontFamily: "Inter_500Medium", color: "#1A1A1A", lineHeight: 16 },
  ratingRow: { flexDirection: "row", alignItems: "center", gap: 3 },
  ratingText: { fontSize: 11, fontFamily: "Inter_600SemiBold", color: "#1A1A1A" },
  reviewCount: { fontSize: 10, color: "#999", fontFamily: "Inter_400Regular" },
  priceRow: { flexDirection: "row", alignItems: "center", gap: 6, flexWrap: "wrap" },
  price: { fontSize: 14, fontFamily: "Inter_700Bold", color: PINK },
  originalPrice: { fontSize: 11, fontFamily: "Inter_400Regular", color: "#aaa", textDecorationLine: "line-through" },
  lowStock: { fontSize: 10, color: "#FF5722", fontFamily: "Inter_600SemiBold" },
  loadingState: { flex: 1, alignItems: "center", justifyContent: "center", gap: 12, paddingTop: 60 },
  loadingText: { fontSize: 14, color: "#999", fontFamily: "Inter_400Regular" },
  emptyState: { alignItems: "center", paddingTop: 60, gap: 10, paddingHorizontal: 32 },
  emptyTitle: { fontSize: 16, fontFamily: "Inter_700Bold", color: "#333" },
  emptySubtitle: { fontSize: 13, color: "#999", fontFamily: "Inter_400Regular", textAlign: "center", lineHeight: 18 },
  clearFiltersBtn: { marginTop: 6, paddingHorizontal: 20, paddingVertical: 10, backgroundColor: PINK, borderRadius: 20 },
  clearFiltersBtnText: { color: "#fff", fontSize: 13, fontFamily: "Inter_600SemiBold" },
  loadMoreBtn: { marginHorizontal: 40, marginVertical: 16, backgroundColor: PINK, paddingVertical: 12, borderRadius: 24, alignItems: "center" },
  loadMoreText: { color: "#fff", fontSize: 14, fontFamily: "Inter_600SemiBold" },
  endText: { textAlign: "center", color: "#bbb", fontSize: 12, fontFamily: "Inter_400Regular", paddingVertical: 16 },

  /* Filter modal */
  modalOverlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.4)" },
  filterSheet: { backgroundColor: "#fff", borderTopLeftRadius: 24, borderTopRightRadius: 24, maxHeight: "80%", paddingHorizontal: 16, paddingTop: 8, paddingBottom: 24 },
  filterHandle: { width: 40, height: 4, backgroundColor: "#E0E0E0", borderRadius: 2, alignSelf: "center", marginBottom: 12 },
  filterHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 16 },
  filterTitle: { fontSize: 17, fontFamily: "Inter_700Bold", color: "#1A1A1A" },
  filterSection: { marginBottom: 20 },
  filterSectionTitle: { fontSize: 14, fontFamily: "Inter_700Bold", color: "#1A1A1A", marginBottom: 10 },
  filterChips: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  filterChip: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20, backgroundColor: "#F5F5F5", borderWidth: 1, borderColor: "#E0E0E0" },
  filterChipActive: { backgroundColor: "#FFF0F5", borderColor: PINK },
  filterChipText: { fontSize: 13, fontFamily: "Inter_500Medium", color: "#555" },
  filterChipTextActive: { color: PINK },
  toggleRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  toggleSub: { fontSize: 12, color: "#999", fontFamily: "Inter_400Regular", marginTop: 2 },
  toggle: { width: 44, height: 24, borderRadius: 12, backgroundColor: "#E0E0E0", justifyContent: "center", paddingHorizontal: 2 },
  toggleActive: { backgroundColor: PINK },
  toggleKnob: { width: 20, height: 20, borderRadius: 10, backgroundColor: "#fff", elevation: 2, shadowColor: "#000", shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.2, shadowRadius: 2 },
  toggleKnobActive: { alignSelf: "flex-end" },
  filterActions: { flexDirection: "row", gap: 12, paddingTop: 12, borderTopWidth: 1, borderTopColor: "#F0F0F0" },
  resetBtn: { flex: 1, paddingVertical: 13, borderRadius: 12, borderWidth: 1, borderColor: "#E0E0E0", alignItems: "center" },
  resetBtnText: { fontSize: 14, fontFamily: "Inter_600SemiBold", color: "#555" },
  applyBtn: { flex: 2, paddingVertical: 13, borderRadius: 12, backgroundColor: PINK, alignItems: "center" },
  applyBtnText: { fontSize: 14, fontFamily: "Inter_600SemiBold", color: "#fff" },
});
