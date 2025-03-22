import { PermissionResponse } from "expo-camera";
import { Button, Text, View } from "react-native";
import styles from "../style";

export default function Permission (props:{
    requestPermissions: () => Promise<PermissionResponse>;
    permissionType: string;
}) {
    const { requestPermissions, permissionType } = props;
    return (
      <View style={styles.container}>
        <Text style={styles.message}>We need your {permissionType} permission</Text>
        <Button onPress={requestPermissions} title="grant permission" />
      </View>
    );
}