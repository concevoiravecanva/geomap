import { Rows, Text } from "@canva/app-ui-kit";
import { FormattedMessage } from "react-intl";
import * as styles from "styles/components.css";
import { AccessibleMap } from "src/components/AccessibleMap";

export const App = () => {

  return (
    <div className={styles.scrollContainer}>
      <Rows spacing="2u">
        <Text>
          <FormattedMessage
            defaultMessage="
              To make changes to this app, edit the <code>src/app.tsx</code> file,
              then close and reopen the app in the editor to preview the changes.
            "
            description="Instructions for how to make changes to the app. Do not translate <code>src/app.tsx</code>."
            values={{
              code: (chunks) => <code>{chunks}</code>,
            }}
          />
        </Text>
  <AccessibleMap />
      </Rows>
    </div>
  );
};
