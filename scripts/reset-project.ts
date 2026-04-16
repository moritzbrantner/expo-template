import fs from 'node:fs';
import path from 'node:path';
import readline from 'node:readline';

type UserInput = 'y' | 'n';

const root = process.cwd();
const oldDirs = ['app', 'components', 'hooks', 'constants', 'scripts'] as const;
const exampleDir = 'app-example';
const newAppDir = 'app';
const exampleDirPath = path.join(root, exampleDir);

const indexContent = `import { Text, View } from "react-native";

export default function Index() {
  return (
    <View
      style={{
        flex: 1,
        justifyContent: "center",
        alignItems: "center",
      }}
    >
      <Text>Edit app/index.tsx to edit this screen.</Text>
    </View>
  );
}
`;

const layoutContent = `import { Stack } from "expo-router";

export default function RootLayout() {
  return <Stack />;
}
`;

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
});

async function moveDirectories(userInput: UserInput): Promise<void> {
  try {
    if (userInput === 'y') {
      await fs.promises.mkdir(exampleDirPath, { recursive: true });
      console.log(`📁 /${exampleDir} directory created.`);
    }

    for (const dir of oldDirs) {
      const oldDirPath = path.join(root, dir);

      if (!fs.existsSync(oldDirPath)) {
        console.log(`➡️ /${dir} does not exist, skipping.`);
        continue;
      }

      if (userInput === 'y') {
        const newDirPath = path.join(root, exampleDir, dir);
        await fs.promises.rename(oldDirPath, newDirPath);
        console.log(`➡️ /${dir} moved to /${exampleDir}/${dir}.`);
        continue;
      }

      await fs.promises.rm(oldDirPath, { recursive: true, force: true });
      console.log(`❌ /${dir} deleted.`);
    }

    const newAppDirPath = path.join(root, newAppDir);
    await fs.promises.mkdir(newAppDirPath, { recursive: true });
    console.log('\n📁 New /app directory created.');

    const indexPath = path.join(newAppDirPath, 'index.tsx');
    await fs.promises.writeFile(indexPath, indexContent, 'utf8');
    console.log('📄 app/index.tsx created.');

    const layoutPath = path.join(newAppDirPath, '_layout.tsx');
    await fs.promises.writeFile(layoutPath, layoutContent, 'utf8');
    console.log('📄 app/_layout.tsx created.');

    console.log('\n✅ Project reset complete. Next steps:');
    console.log(
      `1. Run \`bun start\` to start a development server.\n2. Edit app/index.tsx to edit the main screen.${
        userInput === 'y'
          ? `\n3. Delete the /${exampleDir} directory when you're done referencing it.`
          : ''
      }`,
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    console.error(`❌ Error during script execution: ${message}`);
  }
}

rl.question(
  'Do you want to move existing files to /app-example instead of deleting them? (Y/n): ',
  (answer) => {
    const userInput = (answer.trim().toLowerCase() || 'y') as string;

    if (userInput === 'y' || userInput === 'n') {
      void moveDirectories(userInput).finally(() => rl.close());
      return;
    }

    console.log("❌ Invalid input. Please enter 'Y' or 'N'.");
    rl.close();
  },
);
