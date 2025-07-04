import { useEffect, useState } from "react";
import { SetupGuide } from "./SetupGuide";
//import { verifyCompatibility } from "../api/verification";
//import { trackEvent, trackingEvents } from "../utils/trackingUtils";
import {
  fetchIsThemeBlockAdded,
  fetchIsThemeCompatible,
  saveIsThemeBlockAdded,
  saveIsThemeCompatible,
} from "../utils/localStorage";
//import { redirectWithin } from "../utils/shopifyApp";
//import { getThemeEditorUrl } from "../utils/theme";
//import { completeOnboarding } from "../api/merchant";

const STEPS = {
  INSTALL_APP: 0,
  ADD_THEME_BLOCK: 1,
};



export default function Onboarding() {
  const merchant = { isOnboardingCompleted: false, shop: "epischatagentstore.myshopify.com" };   
  
  const [items, setItems] = useState([]);
  const [showGuide, setShowGuide] = useState(true);

  useEffect(() => {
    const isThemeBlockAdded = fetchIsThemeBlockAdded() || false;
    console.log(isThemeBlockAdded)

    const ITEMS = [
      {
        id: STEPS.THEME_COMPATIBILITY,
        title: "Install our app",
        expanded: false,
        complete: true,
      },
      {
        id: STEPS.ADD_THEME_BLOCK,
        title: "Enable the theme extension",
        description:
          "Enable the theme extension in your theme editor",
        complete: isThemeBlockAdded,
        expanded: true,
        primaryButton: {
          content: "Enable extension",
          props: {
            url: `https://${merchant.shop}/admin/themes/current/editor?context=apps&appEmbed=b16eabbb2a6d85c2ba60b59845cb3054%2Fchat-interface`,
            external: true,
          },
        },
      },
    ];

    const expandedItem = ITEMS.map((item, index) => {
      const isFirstIncomplete =
        ITEMS.findIndex((step) => !step.complete) === index;

      return {
        ...item,
        expanded: !item.complete && isFirstIncomplete,
      };
    });

    setItems(expandedItem);
  }, []);

  useEffect(() => {
    if (merchant) {
        setShowGuide(!merchant.isOnboardingCompleted);      
    }
  }, [merchant]);

  const onForceComplete = async (step) => {
    if (step === STEPS.THEME_COMPATIBILITY) {
      const currentItem = items.find((item) => item.id === step);
      saveIsThemeCompatible(!currentItem.complete);
    } else if (step === STEPS.ADD_THEME_BLOCK) {
      const currentItem = items.find((item) => item.id === step);
      saveIsThemeBlockAdded(!currentItem.complete);
      await completeOnboarding();
    }

    setItems((prev) =>
      prev.map((item) => {
        return {
          ...item,
          complete: item.id === step ? !item.complete : item.complete,
        };
      })
    );
  };

  const handleDismiss = async (id) => {

    if (!id) {
      setShowGuide(false);
      await completeOnboarding();
      return;
    }

    if (id === STEPS.THEME_COMPATIBILITY) {
      saveIsThemeCompatible(true);
    } else if (id === STEPS.ADD_THEME_BLOCK) {
      saveIsThemeBlockAdded(true);
    }

    const currentIndex = items.findIndex((item) => item.id === id);

    setItems((prev) =>
      prev.map((item) => {
        return {
          ...item,
          complete: item.id === id ? true : item.complete,
          expanded: item.id === currentIndex + 1,
        };
      })
    );
  };

  const completeStep = (id) => {
    onForceComplete(id);
    const currentIndex = items.findIndex((item) => item.id === id);

    setItems((prev) =>
      prev.map((item) => ({
        ...item,
        loading: item.id === id ? false : item.loading,
        expanded: item.id === currentIndex + 1,
      }))
    );
  };

  const handleSubmit = async (id) => {
    try {
      setItems((prev) =>
        prev.map((item) => ({ ...item, loading: item.id === id }))
      );

      switch (id) {
        case STEPS.THEME_COMPATIBILITY:
          //trackEvent(trackingEvents.THEME_COMPATIBILITY_BUTTON);
          const { isCompatible } = await verifyCompatibility();

          if (!isCompatible) {
            shopify.toast.show("Theme check failed", { type: "error" });
            return;
          }
          saveIsThemeCompatible(isCompatible);
          completeStep(id);
          break;
        case STEPS.ADD_THEME_BLOCK:
          completeStep(id);
          await completeOnboarding();
          const themeEditorUrl = "getThemeEditorUrl(merchant?.shop)";
          window.open(themeEditorUrl, "_blank");
          break;
        default:
          break;
      }
    } catch (err) {}
  };

  const setExpanded = (id) => {
    setItems((prev) =>
      prev.map((item) => ({ ...item, expanded: item.id === id }))
    );
  };

  if (!showGuide) return null;

  return (
    <div className="max-w-[60rem] m-auto">
      <SetupGuide
        handleDismiss={handleDismiss}
        handleSubmit={handleSubmit}
        onForceComplete={onForceComplete}
        items={items}
        setExpanded={setExpanded}
      />
    </div>
  );
}