import { useNavigate, useSearch } from "@tanstack/react-router";
import { useCallback, useMemo } from "react";
import { PRODUCT_FILTERS, filterByProduct, type ProductFilter } from "@/data/persistency";
import { personaById } from "@/config/personas";
import { usePolicies } from "@/store/persistency";

/** Persona (?as=) and product (?product=) shared by every Persistency page. */
export function useShell() {
  const search = useSearch({ from: "/persistency" });
  const navigate = useNavigate();
  const product: ProductFilter = search.product && (PRODUCT_FILTERS as readonly string[]).includes(search.product)
    ? (search.product as ProductFilter)
    : "All";
  const persona = personaById(search.as);
  const setProduct = useCallback(
    (p: ProductFilter) => navigate({ to: ".", search: (prev: Record<string, unknown>) => ({ ...prev, product: p }) } as never),
    [navigate],
  );
  return { product, persona, setProduct };
}

/** Policies filtered by the product switch. */
export function useScopedPolicies() {
  const { product } = useShell();
  const all = usePolicies();
  const scoped = useMemo(() => filterByProduct(all, product), [all, product]);
  return { all, scoped, product };
}
