export interface DeliveryDetails {
  name: string;
  phone?: string | null;
  email?: string | null;
  product?: string;
  quantity?: string;
  address?: string;
}
/** DOM text nodes keep customer content out of HTML parsing in both map providers. */
export function createDeliveryPopup(title: string, details?: DeliveryDetails): HTMLElement {
  const root = document.createElement("div");
  root.className = "delivery-popup";
  const heading = document.createElement("strong");
  heading.textContent = title;
  root.append(heading);
  if (!details) return root;
  const list = document.createElement("dl");
  const fields = [["Name", details.name], ["Phone", details.phone], ["Email", details.email], ["Product", details.product], ["Quantity", details.quantity], ["Address", details.address]];
  for (const [label, value] of fields) {
    const term = document.createElement("dt"); term.textContent = label ?? "";
    const content = document.createElement("dd"); content.textContent = value || "Not provided";
    list.append(term, content);
  }
  root.append(list);
  if (details.phone) {
    const call = document.createElement("a"); call.href = `tel:${details.phone.replace(/[^+\d]/g, "")}`; call.textContent = "Call customer"; root.append(call);
  }
  return root;
}
