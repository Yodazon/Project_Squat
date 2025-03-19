import { useState } from 'react';
import { BleManager, Device, Characteristic } from 'react-native-ble-plx';
import { PermissionsAndroid, Platform } from 'react-native';
import * as ExpoDevice from 'expo-device';
import * as Location from 'expo-location';

// Define interfaces
export interface DeviceCharacteristic extends Characteristic {}

// Create a singleton BLE manager instance
const bleManager = new BleManager();

export const useBLE = () => {
  const [scanning, setScanning] = useState<boolean>(false);
  const [devices, setDevices] = useState<Device[]>([]);
  const [connectedDevice, setConnectedDevice] = useState<Device | null>(null);
  const [deviceCharacteristics, setDeviceCharacteristics] = useState<DeviceCharacteristic[]>([]);
  const [selectedCharacteristic, setSelectedCharacteristic] = useState<DeviceCharacteristic | null>(null);
  const [receivedData, setReceivedData] = useState<string>("");
  const [controlValue, setControlValue] = useState<number>(0);

  // Check permissions function
  const checkPermissions = async (): Promise<boolean> => {
    if (ExpoDevice.osName !== 'Android' && ExpoDevice.osName !== 'iOS') {
      alert('BLE only allowed on iOS and Android');
      return false;
    }

    try {
      if (Platform.OS === 'ios') {
        // iOS handling
        const { status } = await Location.requestBackgroundPermissionsAsync();
        if (status !== 'granted') {
          alert('Location permission is required to use Bluetooth on iOS');
          return false;
        }
      } else if (Platform.OS === 'android') {
        // Android handling
        const apiLevel = ExpoDevice.osVersion ? parseInt(ExpoDevice.osVersion, 10) : 0;

        // Android 12+ (API level 31+) needs BLUETOOTH_SCAN and BLUETOOTH_CONNECT
        if (apiLevel >= 31) {
          const bluetoothScanStatus = await PermissionsAndroid.request(
            PermissionsAndroid.PERMISSIONS.BLUETOOTH_SCAN,
            {
              title: 'Bluetooth Scan Permission',
              message: 'This app requires Bluetooth scanning permission to find devices',
              buttonPositive: 'OK',
            }
          );
          
          const bluetoothConnectStatus = await PermissionsAndroid.request(
            PermissionsAndroid.PERMISSIONS.BLUETOOTH_CONNECT,
            {
              title: 'Bluetooth Connect Permission',
              message: 'This app requires bluetooth connection permission to connect to devices',
              buttonPositive: 'OK',
            }
          );
          
          const fineLocationStatus = await PermissionsAndroid.request(
            PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION,
            {
              title: 'Location Permission',
              message: 'This app requires fine location permission to find nearby bluetooth devices',
              buttonPositive: 'OK',
            }
          );
          
          if (
            bluetoothConnectStatus !== 'granted' ||
            bluetoothScanStatus !== 'granted' ||
            fineLocationStatus !== 'granted'
          ) {
            alert('Bluetooth and Location permissions are required for proper functionality');
            return false;
          }
        } else { // Android 6 - 11
          const fineLocationStatus = await PermissionsAndroid.request(
            PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION,
            {
              title: 'Location Permission',
              message: 'This app requires fine location permission to find nearby bluetooth devices',
              buttonPositive: 'OK',
            }
          );
          
          if (fineLocationStatus !== 'granted') {
            alert('Location permissions is required for functionality on Android');
            return false;
          }
        }
      }
      return true;
    } catch (error) {
      console.error('Error Checking Permissions:', error);
      return false;
    }
  };

  // Scan for BLE Devices
  const startScan = async (): Promise<void> => {
    if (scanning) return;
    
    // Check permissions before scanning
    const hasPermissions = await checkPermissions();
    if (!hasPermissions) return;

    // Clear previous devices
    setDevices([]);
    setScanning(true);

    bleManager.startDeviceScan(null, null, (error, device) => {
      if (error) {
        console.error('Scan error:', error);
        setScanning(false);
        return;
      }
      
      // Add devices with names containing "Arduino"
      if (device && device.name?.includes("Arduino")) {
        // Check if it is already on the list
        setDevices(prevDevices => {
          if (!prevDevices.find(d => d.id === device.id)) {
            return [...prevDevices, device];
          }
          return prevDevices;
        });
      }
    });

    // Stop scanning after 10 seconds
    setTimeout(() => {
      bleManager.stopDeviceScan();
      setScanning(false);
    }, 10000);
  };

  // Connect to selected Device
  const connectToDevice = async (device: Device): Promise<void> => {
    try {
      setScanning(false);
      bleManager.stopDeviceScan();

      // Connect to the device
      const connectedDevice = await bleManager.connectToDevice(device.id);
      setConnectedDevice(connectedDevice);

      // Discover all services and characteristics
      await connectedDevice.discoverAllServicesAndCharacteristics();
      const services = await connectedDevice.services();

      // Get all characteristics from all services
      let allCharacteristics: DeviceCharacteristic[] = [];
      for (const service of services) {
        const characteristics = await service.characteristics();
        allCharacteristics = [...allCharacteristics, ...characteristics as DeviceCharacteristic[]];
      }

      setDeviceCharacteristics(allCharacteristics);

      // Setup monitoring for device disconnection
      connectedDevice.onDisconnected(() => {
        setConnectedDevice(null);
        setDeviceCharacteristics([]);
        setSelectedCharacteristic(null);
        setReceivedData('');
        alert('Device Disconnected');
      });

    } catch (error: any) {
      console.error('Connection Error:', error);
      alert(`Connection Error: ${error.message}`);
    }
  };

  // Disconnect from current device
  const disconnectDevice = async (): Promise<void> => {
    if (connectedDevice) {
      await bleManager.cancelDeviceConnection(connectedDevice.id);
      setConnectedDevice(null);
      setDeviceCharacteristics([]);
      setSelectedCharacteristic(null);
      setReceivedData('');
    }
  };

  // Monitor a characteristic for notifications/indicators
  const monitorCharacteristic = async (characteristic: DeviceCharacteristic): Promise<void> => {
    try {
      setSelectedCharacteristic(characteristic);

      // Start monitoring the characteristic for changes 
      characteristic.monitor((error, char) => {
        if (error) {
          console.error('Monitoring error:', error);
          return;
        }

        // Convert the received value to a string
        if (char && char.value) {
          const decodedValue = base64ToAscii(char.value);
          setReceivedData(prev => prev + decodedValue + '\n');
        }
      });
      alert(`Monitoring characteristic: ${characteristic.uuid}`);
    } catch (error: any) {
      console.error('Error Setting up monitor:', error);
      alert(`Error: ${error.message}`);
    }
  };

  // Send value to Arduino
  const sendValue = async (value: string | number): Promise<void> => {
    if (!selectedCharacteristic) {
      alert('Please select a characteristic first');
      return;
    }

    try {
      // Convert value to an ASCII string then to base64
      const data = asciiToBase64(value.toString());

      // Write the value to the characteristic
      await selectedCharacteristic.writeWithResponse(data);

      // Update the control value
      if (typeof value === 'number') {
        setControlValue(value);
      } else {
        const numericValue = parseInt(value, 10);
        if (!isNaN(numericValue)) {
          setControlValue(numericValue);
        }
      }
    } catch (error: any) {
      console.error('Write Error:', error);
      alert(`Write error: ${error.message}`);
    }
  };

  // Helper functions for base64 conversion
  const base64ToAscii = (base64: string): string => {
    try {
      return Buffer.from(base64, 'base64').toString('ascii');
    } catch (error) {
      return atob(base64);
    }
  };

  const asciiToBase64 = (ascii: string): string => {
    try {
      return Buffer.from(ascii).toString('base64');
    } catch (error) {
      return btoa(ascii);
    }
  };

  // Clean up function to be called when unmounting
  const cleanup = (): void => {
    if (connectedDevice) {
      bleManager.cancelDeviceConnection(connectedDevice.id);
    }
  };

  return {
    scanning,
    devices,
    connectedDevice,
    deviceCharacteristics,
    selectedCharacteristic,
    receivedData,
    controlValue,
    startScan,
    connectToDevice,
    disconnectDevice,
    monitorCharacteristic,
    sendValue,
    cleanup,
  };
};