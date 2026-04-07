import { useCallback, useMemo } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { useAtom } from "jotai/react";
import { v4 as uuidv4 } from "uuid";

import type { TextContent, ImageContent } from "../api/types.gen";
import { currentIdentity } from "../identity";
import type { Identity } from "../identity";
import { designCreated, designShared } from "../telemetry";
import { createAtom } from "../utils/createAtom";
import { getDesignId } from "../utils/getDesignId";

export type Design = {
  createdBy?: Identity;
  id: string;
  problem: (TextContent | ImageContent)[];
  title?: string;
};

const designsAtom = createAtom<Design[]>({
  name: "designs",
  initialValue: [],
  scope: "user",
});

export function useDesigns() {
  const location = useLocation();

  const navigate = useNavigate();

  const [designs, setDesigns] = useAtom(designsAtom);

  const getDesign = useCallback(
    (designId: string) => {
      return designs.find((design) => design.id === designId);
    },
    [designs],
  );

  const cloneDesign = useCallback(
    async (designId: string) => {
      const design = getDesign(designId);
      if (!design) {
        return;
      }

      await setDesigns((prev) => {
        if (prev.some((d) => d.id === designId)) {
          return prev;
        } else {
          designShared.add(1, {
            design_id: design.id,
            shared_by: design.createdBy?.email,
          });

          return [design, ...(prev ?? [])];
        }
      });
    },
    [setDesigns, getDesign],
  );

  const createDesign = useCallback(
    async ({
      problem,
      title,
    }: {
      problem: (TextContent | ImageContent)[];
      title?: string;
    }) => {
      const design: Design = {
        createdBy: currentIdentity,
        problem,
        id: uuidv4().toString(),
        title,
      };

      designCreated.add(1, {
        created_by: design.createdBy?.email,
      });

      await setDesigns((prev) => {
        return [design, ...(prev ?? [])];
      });

      return design;
    },
    [setDesigns],
  );

  const currentDesign = useMemo(() => {
    const designId = getDesignId(location.pathname);
    return designs.find((design) => design.id === designId);
  }, [location.pathname, designs]);

  const removeDesign = useCallback(
    async (designId: string) => {
      await setDesigns((prev) => {
        return prev.filter((design) => design.id !== designId);
      });
    },
    [setDesigns],
  );

  const selectDesign = useCallback(
    (designId: string) => {
      if (designId !== currentDesign?.id) {
        navigate(`/design/${designId}`);
      }
    },
    [currentDesign, navigate],
  );

  const updateDesign = useCallback(
    async (update: Partial<Design> & { id: string }) => {
      await setDesigns((prev) => {
        return prev.map((design) =>
          design.id === update.id ? { ...design, ...update } : design,
        );
      });
    },
    [setDesigns],
  );

  return {
    cloneDesign,
    createDesign,
    currentDesign,
    getDesign,
    designs,
    removeDesign,
    selectDesign,
    updateDesign,
  };
}
