import type { AnchorHTMLAttributes, MouseEvent } from "react";
import { previewNavigate } from "./navigation";

type Props = Omit<AnchorHTMLAttributes<HTMLAnchorElement>, "href"> & { href: string };

/** 外部遷移をせず、サンプルのメモリ内画面だけを切り替える Link。 */
export default function Link({ href, onClick, target, ...props }: Props) {
  function follow(event: MouseEvent<HTMLAnchorElement>) {
    onClick?.(event);
    if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey || target) return;
    event.preventDefault();
    previewNavigate(href);
  }
  return <a {...props} href={`#${href}`} target={target} onClick={follow} />;
}
