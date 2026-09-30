import { Badge } from "@/components/ui/badge";
import type { Visibility } from "@/lib/domain/types";

/** Status alat dalam teks (bukan hanya warna, Req 18.4). */
export function ItemBadges({
  visibility,
  isActive,
  allowKtp,
}: {
  visibility: Visibility;
  isActive: boolean;
  allowKtp: boolean;
}) {
  return (
    <div className="flex flex-wrap gap-1">
      {!isActive ? (
        <Badge className="bg-muted text-muted-foreground">Nonaktif</Badge>
      ) : visibility === "PUBLIC" ? (
        <Badge className="bg-success-muted text-success">Publik</Badge>
      ) : (
        <Badge className="bg-info-muted text-info">Internal</Badge>
      )}
      {!allowKtp && <Badge className="bg-warning-muted text-warning">Tanpa KTP</Badge>}
    </div>
  );
}
