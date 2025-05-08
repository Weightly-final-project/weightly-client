import { PermissionResponse } from "expo-camera";
import { Button, Text, View } from "react-native";

export default function Permission(props: {
    requestPermissions: () => Promise<PermissionResponse>;
    permissionType: string;
}) {
    const { requestPermissions, permissionType } = props;
    return (
      <View className="flex-1 justify-center">
        <Text className="text-center pb-2.5">We need your {permissionType} permission</Text>
        <Button onPress={requestPermissions} title="grant permission" />
      </View>
    );
}