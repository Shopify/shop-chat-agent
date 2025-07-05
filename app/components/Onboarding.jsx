import { useEffect, useState } from "react";
import { SetupGuide } from "./SetupGuide";

const STEPS = {
  INSTALL_APP: 0,
  ADD_THEME_BLOCK: 1,
};

const STORAGE_KEYS = {
  IS_THEME_BLOCK_ADDED: "isThemeBlockAdded",
  IS_ONBOARDING_COMPLETED: "isOnboardingCompleted",
};

export default function Onboarding({ THEME_EXTENSION_ID, THEME_APP_EXTENSION_NAME }) {
  const [items, setItems] = useState([]);
  const [showGuide, setShowGuide] = useState(true);

  useEffect(() => {
    const isThemeBlockAdded =
      localStorage.getItem(STORAGE_KEYS.IS_THEME_BLOCK_ADDED) === "true";
    const isOnboardingCompleted =
      localStorage.getItem(STORAGE_KEYS.IS_ONBOARDING_COMPLETED) === "true";

    setShowGuide(!isOnboardingCompleted);

    const ITEMS = [
      {
        id: STEPS.INSTALL_APP,
        title: "Install our app",
        expanded: false,
        complete: true,
      },
      {
        id: STEPS.ADD_THEME_BLOCK,
        title: "Enable the theme extension",
        description: "Enable the theme extension in your theme editor",
        complete: isThemeBlockAdded,
        expanded: !isThemeBlockAdded,
        primaryButton: {
          content: "Enable extension",
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

  const onForceComplete = async (step) => {
    if (step === STEPS.INSTALL_APP) {
      localStorage.setItem(STORAGE_KEYS.IS_ONBOARDING_COMPLETED, "true");
    } else if (step === STEPS.ADD_THEME_BLOCK) {
      localStorage.setItem(STORAGE_KEYS.IS_THEME_BLOCK_ADDED, "true");
    }

    setItems((prev) =>
      prev.map((item) => {
        return {
          ...item,
          complete: item.id === step ? !item.complete : item.complete,
        };
      }),
    );
  };

  const handleDismiss = async (id) => {
    if (!id) {
      setShowGuide(false);
      localStorage.setItem(STORAGE_KEYS.IS_ONBOARDING_COMPLETED, "true");
      return;
    }

    if (id === STEPS.INSTALL_APP) {
      localStorage.setItem(STORAGE_KEYS.IS_ONBOARDING_COMPLETED, "true");
    }

    if (id === STEPS.ADD_THEME_BLOCK) {
      localStorage.setItem(STORAGE_KEYS.IS_THEME_BLOCK_ADDED, "true");
    }

    const currentIndex = items.findIndex((item) => item.id === id);

    setItems((prev) =>
      prev.map((item) => {
        return {
          ...item,
          complete: item.id === id ? true : item.complete,
          expanded: item.id === currentIndex + 1,
        };
      }),
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
      })),
    );
  };

  const handleSubmit = async (id) => {
    console.log(id);

    try {
      setItems((prev) =>
        prev.map((item) => ({ ...item, loading: item.id === id })),
      );

      switch (id) {
        case STEPS.INSTALL_APP:
          localStorage.setItem(STORAGE_KEYS.IS_ONBOARDING_COMPLETED, "true");
          completeStep(id);
          break;
        case STEPS.ADD_THEME_BLOCK:
          const subdomain = window.shopify.config.shop.split(".")[0];

          const themeEditorUrl = `https://admin.shopify.com/store/${subdomain}/themes/current/editor?context=apps&activateAppId=${THEME_EXTENSION_ID}/${THEME_APP_EXTENSION_NAME}`;
          open(themeEditorUrl, "_blank");
          completeStep(id);
          break;
        default:
          break;
      }
    } catch (err) {}
  };

  const setExpanded = (id) => {
    setItems((prev) =>
      prev.map((item) => ({ ...item, expanded: item.id === id })),
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
