import React from 'react';
import { View, TouchableOpacity, ScrollView, Image } from 'react-native';
import { Text } from '../ui';
import { styles } from '../styles';
import TransactionForm from '../TransactionForm';

export default function EditScreen({ tx, onSave, onDelete, onClose, accounts, mainAccountId }) {
  return (
    <ScrollView contentContainerStyle={styles.screen} keyboardShouldPersistTaps="handled">
      <View style={styles.spaceBetween}>
        <Text style={styles.title}>Edit entry</Text>
        <TouchableOpacity onPress={onClose}>
          <Text style={styles.link}>Close</Text>
        </TouchableOpacity>
      </View>
      {tx.receiptUri && <Image source={{ uri: tx.receiptUri }} style={styles.receipt} resizeMode="contain" />}
      <TransactionForm
        initial={tx}
        accounts={accounts}
        mainAccountId={mainAccountId}
        showItems={(tx.items && tx.items.length > 0) || !!tx.receiptUri}
        onSave={onSave}
        onDelete={onDelete}
        submitLabel="Save changes"
      />
    </ScrollView>
  );
}
