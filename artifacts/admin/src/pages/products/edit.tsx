import { useParams } from "wouter";
import ProductForm from "./form";

export default function EditProduct() {
  const params = useParams<{ id: string }>();
  const productId = parseInt(params.id ?? "0");
  return <ProductForm productId={productId} />;
}
