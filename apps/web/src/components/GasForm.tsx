import React, { useState } from 'react';
import { Modal, Form, InputNumber, DatePicker, TimePicker, Checkbox, message, Alert } from 'antd';
import dayjs, { Dayjs } from 'dayjs';

interface GasFormProps {
  open: boolean;
  onClose: () => void;
  onSubmit: (data: { counterValue: number; readingDate: string }) => Promise<void>;
  isLoading?: boolean;
}

export const GasForm: React.FC<GasFormProps> = ({ open, onClose, onSubmit, isLoading = false }) => {
  const [form] = Form.useForm();
  const [useCurrentDateTime, setUseCurrentDateTime] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const handleSubmit = async () => {
    try {
      setErrorMessage(null);
      const values = await form.validateFields();

      // Build the reading date
      let readingDate: string;

      if (useCurrentDateTime) {
        readingDate = dayjs().toISOString();
      } else {
        const date = values.date as Dayjs;
        const time = values.time as Dayjs;

        if (!date || !time) {
          message.error('Please select both date and time');
          return;
        }

        // Combine date and time
        const combined = date
          .hour(time.hour())
          .minute(time.minute())
          .second(0);

        readingDate = combined.toISOString();
      }

      await onSubmit({
        counterValue: values.counterValue,
        readingDate,
      });

      message.success('Gas reading added successfully');
      form.resetFields();
      setUseCurrentDateTime(true);
      setErrorMessage(null);
      onClose();
    } catch (error: any) {
      // Extract error message from backend response
      const errorMsg =
        error?.response?.data?.message ||
        error?.message ||
        'Failed to add gas reading';

      setErrorMessage(errorMsg);
      console.error('Form submission error:', error);
    }
  };

  const handleCancel = () => {
    form.resetFields();
    setUseCurrentDateTime(true);
    setErrorMessage(null);
    onClose();
  };

  return (
    <Modal
      title="Add Gas Reading"
      open={open}
      onOk={handleSubmit}
      onCancel={handleCancel}
      confirmLoading={isLoading}
      okText="Add Reading"
      cancelText="Cancel"
      width={400}
    >
      {errorMessage && (
        <Alert
          message="Error"
          description={errorMessage}
          type="error"
          showIcon
          closable
          onClose={() => setErrorMessage(null)}
          style={{ marginBottom: '16px' }}
        />
      )}

      <Form
        form={form}
        layout="vertical"
        autoComplete="off"
        disabled={isLoading}
      >
        {/* Counter Value */}
        <Form.Item
          name="counterValue"
          label="Gas Meter Counter (m³)"
          rules={[
            { required: true, message: 'Please enter the counter value' },
            {
              pattern: /^\d+(\.\d{1,3})?$/,
              message: 'Please enter a valid number (up to 3 decimal places)',
            },
            {
              validator: (_, value) => {
                if (value <= 0) {
                  return Promise.reject(new Error('Counter value must be greater than 0'));
                }
                return Promise.resolve();
              },
            },
          ]}
        >
          <InputNumber
            placeholder="e.g., 1234.567"
            step={0.001}
            min={0}
            precision={3}
            style={{ width: '100%' }}
          />
        </Form.Item>

        {/* Use Current Date/Time Checkbox */}
        <Form.Item>
          <Checkbox
            checked={useCurrentDateTime}
            onChange={(e) => setUseCurrentDateTime(e.target.checked)}
          >
            Use current date & time
          </Checkbox>
        </Form.Item>

        {/* Date & Time Pickers (shown when not using current) */}
        {!useCurrentDateTime && (
          <>
            <Form.Item
              name="date"
              label="Reading Date"
              rules={[{ required: true, message: 'Please select a date' }]}
            >
              <DatePicker
                style={{ width: '100%' }}
                format="YYYY-MM-DD"
                disabledDate={(current) =>
                  current && current > dayjs().endOf('day')
                }
              />
            </Form.Item>

            <Form.Item
              name="time"
              label="Reading Time"
              rules={[{ required: true, message: 'Please select a time' }]}
            >
              <TimePicker
                format="HH:mm"
                style={{ width: '100%' }}
              />
            </Form.Item>
          </>
        )}

        {/* Current DateTime Display */}
        {useCurrentDateTime && (
          <div style={{
            backgroundColor: '#f6f8fb',
            padding: '12px',
            borderRadius: '4px',
            marginBottom: '16px',
            fontSize: '13px',
            color: '#666',
          }}>
            <strong>Date & Time:</strong> {dayjs().format('MMM DD, YYYY HH:mm')}
          </div>
        )}
      </Form>
    </Modal>
  );
};
